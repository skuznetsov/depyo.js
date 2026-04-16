const AST = require('../ast/ast_node');

function handleKwNamesA() {
    let astNode = new AST.ASTKwNamesMap();
    let keys = this.code.Current.ConstantObject;
    for (let idx = keys.length - 1; idx >= 0; idx--) {
        astNode.add(keys[idx], this.dataStack.pop());
    }

    astNode.line = this.code.Current.LineNo;
    this.dataStack.push(astNode);
}

function handleCallA() {
    handleInstrumentedCallA.call(this);
}

function handleCallFunctionA() {
    handleInstrumentedCallA.call(this);
}

function handleInstrumentedCallKwA() {
    // Instrumented CALL_KW behaves like CALL_KW.
    handleCallKwA.call(this);
}

function handleCallKwA() {
    // Python 3.13 CALL_KW: (callable, self_or_null, args[oparg], kwnames -- res)
    // kwnames is a tuple of strings; the last len(kwnames) of args[] are the kw values.
    let kwnamesNode = this.dataStack.pop();
    let kwNamesList = [];
    const toKwName = (v) => {
        // Render kwarg keys as bare identifiers (foo=1), not string literals ("foo"=1).
        const raw = v?.Value ?? v?.name ?? v;
        const name = typeof raw === 'string' ? raw : String(raw);
        return new AST.ASTName(name.replace(/^['"]|['"]$/g, ''));
    };
    if (kwnamesNode instanceof AST.ASTObject) {
        const obj = kwnamesNode.object;
        if (obj && (obj.ClassName === 'Py_Tuple' || obj.ClassName === 'Py_SmallTuple') && Array.isArray(obj.Value)) {
            kwNamesList = obj.Value.map(toKwName);
        }
    } else if (kwnamesNode instanceof AST.ASTTuple) {
        kwNamesList = (kwnamesNode.values || []).map(toKwName);
    }

    const totalArgs = this.code.Current.Argument;
    const kwcount = kwNamesList.length;
    const pcount = Math.max(0, totalArgs - kwcount);

    let kwparamList = [];
    for (let i = kwcount - 1; i >= 0; i--) {
        let value = this.dataStack.pop();
        kwparamList.unshift({ key: kwNamesList[i], value });
    }

    let pparamList = [];
    for (let i = 0; i < pcount; i++) {
        pparamList.unshift(this.dataStack.pop());
    }

    let func = this.dataStack.pop();
    if (func === null && this.dataStack.length > 0) {
        func = this.dataStack.pop();
    } else if (this.dataStack.length > 0 && this.dataStack.top() == null) {
        this.dataStack.pop();
    }

    let callNode = new AST.ASTCall(func, pparamList, kwparamList);
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleEnterExecutorA() {
    // 3.14 ENTER_EXECUTOR: instrumentation hook, ignore for decompilation.
    if (global.g_cliArgs?.debug) {
        console.log(`[ENTER_EXECUTOR] arg=${this.code.Current.Argument} at offset ${this.code.Current.Offset}`);
    }
}

function handleInstrumentedCallA() {
    let kwparams = (this.code.Current.Argument & 0xFF00) >> 8;
    let pparams = (this.code.Current.Argument & 0xFF);
    let kwparamList = [];
    let pparamList = [];

    // This CALL invokes __build_class__ iff a LoadBuildClass marker sits on the
    // stack at exactly the depth this CALL will consume down to. Otherwise a
    // nested CALL (e.g. `type(Y)` in `class X(type(Y)):`) will falsely trigger
    // the build-class branch because LoadBuildClass is still somewhere below.
    //
    // Stack layout (bottom → top) varies by version:
    //   pre-3.6 CALL_FUNCTION:  [LBC, fn, name, ...bases, k1,v1, ...]; LBC at pparams + 2*kwparams
    //   3.6+ CALL_FUNCTION:     [LBC, fn, name, ...bases];             LBC at pparams
    //   3.11/3.12 CALL:         [NULL, LBC, fn, name, ...bases];       LBC at pparams
    //     (PUSH_NULL emitted before LOAD_BUILD_CLASS, NULL below LBC)
    //   3.13+ CALL:             [LBC, NULL, fn, name, ...bases];       LBC at pparams + 1
    //     (LOAD_BUILD_CLASS emitted before PUSH_NULL, NULL above LBC; peel in pop loop)
    const stackHas = (d) => {
        const idx = this.dataStack.length - 1 - d;
        return idx >= 0 && this.dataStack[idx] instanceof AST.ASTLoadBuildClass;
    };
    let loadBuildClassFound = false;
    if (this.object.Reader.versionCompare(3, 6) >= 0) {
        loadBuildClassFound = stackHas(pparams) || stackHas(pparams + 1);
    } else {
        loadBuildClassFound = stackHas(pparams + 2 * kwparams);
    }

    if (loadBuildClassFound) {
        let bases = [];
        let lbcKwparamList = [];
        const nbases = Math.max(0, pparams - 2);

        if (this.object.Reader.versionCompare(3, 6) < 0) {
            // Pre-3.6: kwargs are alternating key/value pairs on stack.
            for (let i = 0; i < kwparams; i++) {
                let value = this.dataStack.pop();
                let key = this.dataStack.pop();
                lbcKwparamList.unshift({key, value});
            }
            for (let i = 0; i < nbases; i++) {
                bases.unshift(this.dataStack.pop());
            }
        } else {
            // 3.6+: pop exactly nbases items; kwargs flow via CALL_FUNCTION_KW/KW_NAMES.
            // Bases can be arbitrary expressions (ASTName, ASTBinary, ASTCall, ASTSubscr, …).
            for (let i = 0; i < nbases; i++) {
                bases.unshift(this.dataStack.pop());
            }
        }

        let name = this.dataStack.pop();
        let functionNode = this.dataStack.pop();
        let loadbuild = this.dataStack.pop();
        // 3.11+: PUSH_NULL sits between __build_class__ and the function; peel it off.
        if (loadbuild === null && this.dataStack.top() instanceof AST.ASTLoadBuildClass) {
            loadbuild = this.dataStack.pop();
        }
        if (loadbuild instanceof AST.ASTLoadBuildClass) {
            let callNode = new AST.ASTCall(functionNode, [], lbcKwparamList);
            callNode.line = this.code.Current.LineNo;
            let classNode = new AST.ASTClass(callNode, new AST.ASTTuple(bases), name);
            classNode.line = this.code.Current.LineNo;
            classNode.kwargs = lbcKwparamList;
            this.dataStack.push(classNode);
            return;
        }
    }

    if (this.object.Reader.versionCompare(3, 11) >= 0) {
        let kwparams_map = this.dataStack.top();
        if (kwparams_map instanceof AST.ASTKwNamesMap) {
            this.dataStack.pop();
            for (let kwParam of kwparams_map.values) {
                kwparamList.unshift(kwParam);
                kwparams--;
            }
        }
    }
    else {
        for (let idx = 0; idx < kwparams; idx++) {
            let value = this.dataStack.pop();
            let key = this.dataStack.pop();
            kwparamList.unshift({key, value});
        }
    }
    let skipCallNode = false;
    for (let idx = 0; idx < pparams; idx++) {
        let param = this.dataStack.pop();
        if (param instanceof AST.ASTFunction) {
            let fun_code = param.code;
            let code_src = fun_code.object;
            let function_name = code_src.Name;
            if (function_name == "<lambda>") {
                pparamList.unshift(param);
            } else if ( pparams == 1) {
                // Decorator used
                let decorator = this.dataStack.pop();
                param.add_decorator(decorator);
                // Decorating function and returning it back to data stack
                this.dataStack.push(param);
                skipCallNode = true;
                break;
            }
        } else if (param instanceof AST.ASTClass && pparams == 1 && kwparamList.length === 0) {
            // Class decorator: decorator(class) — attach decorator and re-push class
            // so chained class decorators (e.g. @author("Me")\n@author("You")) unwind
            // naturally on the data stack.
            let decorator = this.dataStack.pop();
            param.add_decorator(decorator);
            this.dataStack.push(param);
            skipCallNode = true;
            break;
        } else {
            pparamList.unshift(param);
        }
    }

    if (skipCallNode) {
        return;
    }

    let func = this.dataStack.pop();
    // 3.11+ CALL convention: stack is [callable, self_or_null, args...].
    // We just popped the args; `func` is actually self_or_null, and the real callable is underneath.
    if ([this.OpCodes.CALL_A, this.OpCodes.INSTRUMENTED_CALL_A].includes(this.code.Current.OpCodeID)) {
        if (func === null && this.dataStack.length > 0) {
            // Normal call: PUSH_NULL was self_or_null, real callable below.
            func = this.dataStack.pop();
        } else if (this.dataStack.length > 0 && this.dataStack.top() == null) {
            // Edge case: null sits one slot deeper (rare ordering). Drop it.
            this.dataStack.pop();
        } else if (func instanceof AST.ASTBinary && func.op === AST.ASTBinary.BinOp.Attr) {
            // Python 3.14 LOAD_SPECIAL pushes [self, method] for __enter__/__exit__ etc.;
            // the self below is consumed by the unbound special-method call.
            const attrName = func.right?.name;
            if (['__enter__', '__exit__', '__aenter__', '__aexit__'].includes(attrName)) {
                if (this.dataStack.length > 0) {
                    this.dataStack.pop();
                }
            }
        } else if (this.dataStack.length > 0) {
            // Bound method / decorator pattern: self_or_null is non-null, so
            // the call is real_callable(func, *args). Pop the real callable and
            // promote `func` to the first positional arg.
            const below = this.dataStack.top();
            if (below !== null && below !== undefined && !(below instanceof AST.ASTLoadBuildClass)) {
                const realCallable = this.dataStack.pop();
                // Decorator syntax: single ASTFunction arg with a real name → attach decorator,
                // push the decorated function back so the next STORE renders as `@decorator\ndef name(...)`.
                if (pparamList.length === 0 &&
                    func instanceof AST.ASTFunction &&
                    func.code?.object?.Name &&
                    func.code.object.Name !== "<lambda>") {
                    func.add_decorator(realCallable);
                    this.dataStack.push(func);
                    return;
                }
                pparamList.unshift(func);
                func = realCallable;
            }
        }
    }

    if (func instanceof AST.ASTFunction) {
        const compNames = new Set(["<listcomp>", "<setcomp>", "<dictcomp>", "<genexpr>", "<generator expression>"]);
        const codeObj = func.code?.object;
        if (codeObj && !codeObj.SourceCode) {
            const PycDecompiler = require('../PycDecompiler');
            const innerDecompiler = new PycDecompiler(codeObj);
            try {
                codeObj.SourceCode = innerDecompiler.decompile();
            } catch (e) {
                if (global.g_cliArgs?.strict) throw e;
                this.errors.push({
                    opcode: 'NESTED_DECOMPILE',
                    codeObject: codeObj?.Name?.toString?.() || '<unknown>',
                    message: e?.message || String(e),
                    stack: e?.stack
                });
                if (global.g_cliArgs?.debug) {
                    console.error(`[CALL] Failed to decompile nested function: ${e?.message}`);
                }
            }
            if (innerDecompiler.errors.length) this.errors.push(...innerDecompiler.errors);
        }

        const sourceTop = codeObj?.SourceCode?.list?.top?.() || null;
        const compNode = codeObj?.SourceCode?.list?.find?.(n => n instanceof AST.ASTComprehension) || null;
        if (global.g_cliArgs?.debug) {
            const topType = sourceTop?.constructor?.name || 'null';
            console.log(`[CALL] func=${codeObj?.Name || codeObj?.QualName?.Value || '<?>'} sourceTop=${topType} compNode=${compNode?.constructor?.name || 'null'} hasSource=${!!codeObj?.SourceCode} pparams=${pparamList.length}`);
        }
        const looksLikeComp = compNames.has(func.code?.object?.Name) ||
                              sourceTop instanceof AST.ASTComprehension ||
                              compNode instanceof AST.ASTComprehension ||
                              (sourceTop instanceof AST.ASTReturn && sourceTop.value instanceof AST.ASTComprehension);
        if (looksLikeComp) {
            let resultNode = compNode || sourceTop;
            if (resultNode instanceof AST.ASTReturn) {
                resultNode = resultNode.value;
            }

            // Async comprehension: inner code uses GET_ANEXT instead of
            // FOR_ITER, so no ASTComprehension was produced. Reconstruct
            // from the decompiled source tree.
            if (!(resultNode instanceof AST.ASTComprehension) && codeObj?.SourceCode) {
                let yieldExpr = null;
                let loopVar = null;
                const searchNodes = (nodes) => {
                    if (!nodes) return;
                    for (const node of nodes) {
                        if (node instanceof AST.ASTReturn && node.rettype === AST.ASTReturn.RetType.Yield && node.value) {
                            yieldExpr = node.value;
                        }
                        if (node instanceof AST.ASTStore && !loopVar) {
                            loopVar = node.dest;
                        }
                        if (node instanceof AST.ASTIterBlock && node.blockType === AST.ASTBlock.BlockType.AsyncFor) {
                            if (node.index) loopVar = node.index;
                            if (node.nodes) searchNodes(node.nodes);
                        }
                        if (node?.nodes) searchNodes(node.nodes);
                    }
                };
                searchNodes(codeObj.SourceCode.list);
                // Listcomp/setcomp/dictcomp fallback: the yield expression was
                // saved by processListAppend/MAP_ADD when no For+comp block
                // existed.
                if (!yieldExpr && codeObj._asyncCompYieldExpr) {
                    yieldExpr = codeObj._asyncCompYieldExpr;
                }
                // In 3.8+ inline async comprehensions the STORE_FAST lands
                // inside a try/except block and disappears into the block
                // structure before reaching SourceCode.list. Scan the inner
                // code's instruction list: first STORE_* after GET_ANEXT is
                // the loop variable.
                if (!loopVar) {
                    const innerOps = new this.OpCodes(codeObj);
                    let sawAnext = false;
                    for (const op of innerOps.Instructions || []) {
                        if (!op) continue;
                        if (op.OpCodeID === this.OpCodes.GET_ANEXT) {
                            sawAnext = true;
                            continue;
                        }
                        if (sawAnext && (op.OpCodeID === this.OpCodes.STORE_FAST_A ||
                                         op.OpCodeID === this.OpCodes.STORE_NAME_A ||
                                         op.OpCodeID === this.OpCodes.STORE_DEREF_A)) {
                            const varName = op.Name?.toString?.() || '';
                            if (varName) {
                                loopVar = new AST.ASTName(varName);
                                break;
                            }
                        }
                    }
                }
                if (global.g_cliArgs?.debug) {
                    console.log(`[CALL-RECONSTRUCT] ${codeObj.Name?.toString?.()} yield=${yieldExpr?.constructor?.name} loopVar=${loopVar?.name}`);
                }
                if (yieldExpr && loopVar) {
                    let kind = AST.ASTComprehension.GENERATOR;
                    const objName = codeObj.Name?.toString?.() || '';
                    if (objName.includes('listcomp')) kind = AST.ASTComprehension.LIST;
                    else if (objName.includes('setcomp')) kind = AST.ASTComprehension.SET;
                    else if (objName.includes('dictcomp')) kind = AST.ASTComprehension.DICT;
                    let comp;
                    if (kind === AST.ASTComprehension.DICT && codeObj._asyncCompYieldKey) {
                        comp = new AST.ASTComprehension(yieldExpr, codeObj._asyncCompYieldKey);
                    } else {
                        comp = new AST.ASTComprehension(yieldExpr);
                    }
                    comp.kind = kind;
                    let gen = new AST.ASTIterBlock(AST.ASTBlock.BlockType.AsyncFor, 0, 0, new AST.ASTName('.0'));
                    gen.index = loopVar;
                    gen.comprehension = true;
                    comp.addGenerator(gen);
                    resultNode = comp;
                }
            }

            // Map placeholder iter (.0) to actual argument for comprehensions.
            if (resultNode?.generators) {
                if (global.g_cliArgs?.debug) {
                    console.log(`[CALL] iter placeholders:`, resultNode.generators.map(gen => gen.iter?.codeFragment?.()));
                }
                for (let gen of resultNode.generators) {
                    if (gen.iter instanceof AST.ASTName && gen.iter.name?.match(/^\.\d+$/)) {
                        const paramIdx = ~~gen.iter.name.substring(1);
                        const param = pparamList[paramIdx];
                        gen.iter = param instanceof AST.ASTIteratorValue ? param.value : param;
                        if (global.g_cliArgs?.debug) {
                            console.log(`[CALL] remapped iter .${paramIdx} -> ${gen.iter?.constructor?.name}`);
                        }
                    } else if (gen.iter instanceof AST.ASTName && gen.iter.name === "[outmost-iterable]") {
                        // Py2.4 names the genexpr's first parameter `[outmost-iterable]`
                        const param = pparamList[0];
                        gen.iter = param instanceof AST.ASTIteratorValue ? param.value : param;
                    }
                }
            }

            if (resultNode) {
                // Async listcomp/setcomp/dictcomp: the outer function
                // awaits the comprehension coroutine with GET_AWAITABLE +
                // LOAD_CONST None + YIELD_FROM. Skip these — the await is
                // implicit in the async comprehension syntax.
                if (resultNode instanceof AST.ASTComprehension &&
                    resultNode.kind !== AST.ASTComprehension.GENERATOR) {
                    const nx1 = this.code.Next;
                    const nx2 = nx1?.Next;
                    const nx3 = nx2?.Next;
                    if (nx1 && nx2 && nx3 &&
                        (nx1.OpCodeID == this.OpCodes.GET_AWAITABLE ||
                         nx1.OpCodeID == this.OpCodes.GET_AWAITABLE_A) &&
                        nx2.OpCodeID == this.OpCodes.LOAD_CONST_A &&
                        nx3.OpCodeID == this.OpCodes.YIELD_FROM) {
                        this.code.GoNext(3);
                    }
                }
                this.dataStack.push(resultNode);
                return;
            }
        }
    }

    if ([this.OpCodes.GET_ITER, this.OpCodes.GET_AITER].includes(this.code.Prev.OpCodeID) &&
        func instanceof AST.ASTFunction && func.code?.object?.SourceCode?.list?.top) {
        let ast = func.code.object.SourceCode.list.top();
        if (!(ast instanceof AST.ASTKeyword)) {
            if (ast instanceof AST.ASTReturn) {
                ast = ast.value;
            }
            if (ast?.generators) {
                for (let gen of ast.generators) {
                    if (gen.iter instanceof AST.ASTName && gen.iter.name.match(/^\.\d+$/)) {
                        let paramIdx = ~~gen.iter.name.substring(1);
                        let param = pparamList[paramIdx];
                        if (param instanceof AST.ASTIteratorValue) {
                            param = param.value;
                        }
                        gen.iter = param;
                    } else if (gen.iter instanceof AST.ASTName && gen.iter.name === "[outmost-iterable]") {
                        let param = pparamList[0];
                        if (param instanceof AST.ASTIteratorValue) {
                            param = param.value;
                        }
                        gen.iter = param;
                    }
                }
            }
        }
        this.dataStack.push(ast);

    } else {
        // Python 3.14 with-statement pattern: when calling __enter__,
        // push the context manager (not the call) so STORE_* sets it as withBlock.expr
        if (this._py314WithCtxMgrForStore &&
            func instanceof AST.ASTBinary &&
            func.op === AST.ASTBinary.BinOp.Attr &&
            func.right?.name === '__enter__') {
            this.dataStack.push(this._py314WithCtxMgrForStore);
            this._py314WithCtxMgrForStore = null;
            return;
        }

        let callNode = new AST.ASTCall( func, pparamList, kwparamList);
        callNode.line = this.code.Current.LineNo;
        this.dataStack.push(callNode);
    }
}

function handleCallFunctionVarA() {
    let variable = this.dataStack.pop();
    let kwparams = (this.code.Current.Argument & 0xFF00) >> 8;
    let pparams = (this.code.Current.Argument & 0xFF);
    let kwparamList = [];
    let pparamList = [];
    for (let idx = 0; idx < kwparams; idx++) {
        let value = this.dataStack.pop();
        let key = this.dataStack.pop();
        kwparamList.unshift({key, value});
    }
    for (let idx = 0; idx < pparams; idx++) {
        pparamList.unshift(this.dataStack.pop());
    }
    let func = this.dataStack.pop();

    let callNode = new AST.ASTCall( func, pparamList, kwparamList);
    callNode.var = variable;
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleCallFunctionKwA() {
    if (this.object.Reader.versionCompare(3, 6) >= 0) {
        // Py 3.6+: CALL_FUNCTION_KW(argc) — TOS is a tuple of kwarg names,
        // argc is total args, last len(names) are kwargs.
        let kwnamesNode = this.dataStack.pop();
        let kwNamesList = [];
        const toKwName = (v) => {
            const raw = v?.Value ?? v?.name ?? v;
            const name = typeof raw === 'string' ? raw : String(raw);
            return new AST.ASTName(name.replace(/^['"]|['"]$/g, ''));
        };
        if (kwnamesNode instanceof AST.ASTObject) {
            const obj = kwnamesNode.object;
            if (obj && (obj.ClassName === 'Py_Tuple' || obj.ClassName === 'Py_SmallTuple') && Array.isArray(obj.Value)) {
                kwNamesList = obj.Value.map(toKwName);
            }
        } else if (kwnamesNode instanceof AST.ASTTuple) {
            kwNamesList = (kwnamesNode.values || []).map(toKwName);
        }

        const totalArgs = this.code.Current.Argument;
        const kwcount = kwNamesList.length;
        const pcount = Math.max(0, totalArgs - kwcount);

        let kwparamList = [];
        for (let i = kwcount - 1; i >= 0; i--) {
            let value = this.dataStack.pop();
            kwparamList.unshift({ key: kwNamesList[i], value });
        }

        let pparamList = [];
        for (let i = 0; i < pcount; i++) {
            pparamList.unshift(this.dataStack.pop());
        }

        let func = this.dataStack.pop();

        // 3.6+ class with kwargs uses CALL_FUNCTION_KW:
        //   LOAD_BUILD_CLASS / MAKE_FUNCTION / LOAD_CONST name / <bases>
        //   / LOAD_CONST (kwarg_names_tuple) / CALL_FUNCTION_KW argc
        // pparamList is [body_func, class_name, ...bases]; kwparamList carries
        // the class kwargs (metaclass, **__init_subclass__ kwargs, ...).
        if (func instanceof AST.ASTLoadBuildClass && pparamList.length >= 2) {
            const functionNode = pparamList[0];
            const nameNode = pparamList[1];
            const bases = pparamList.slice(2);
            const classCall = new AST.ASTCall(functionNode, [], kwparamList);
            classCall.line = this.code.Current.LineNo;
            const classNode = new AST.ASTClass(classCall, new AST.ASTTuple(bases), nameNode);
            classNode.line = this.code.Current.LineNo;
            classNode.kwargs = kwparamList;
            this.dataStack.push(classNode);
            return;
        }

        let callNode = new AST.ASTCall(func, pparamList, kwparamList);
        callNode.line = this.code.Current.LineNo;
        this.dataStack.push(callNode);
        return;
    }

    let kw = this.dataStack.pop();
    let kwparams = (this.code.Current.Argument & 0xFF00) >> 8;
    let pparams = (this.code.Current.Argument & 0xFF);
    let kwparamList = [];
    let pparamList = [];
    for (let idx = 0; idx < kwparams; idx++) {
        let value = this.dataStack.pop();
        let key = this.dataStack.pop();
        kwparamList.unshift({key, value});
    }
    for (let idx = 0; idx < pparams; idx++) {
        pparamList.unshift(this.dataStack.pop());
    }
    let func = this.dataStack.pop();

    let callNode = new AST.ASTCall( func, pparamList, kwparamList);
    callNode.kw = kw;
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleCallFunctionVarKwA() {
    let kw = this.dataStack.pop();
    let variable = this.dataStack.pop();
    let kwparams = (this.code.Current.Argument & 0xFF00) >> 8;
    let pparams = (this.code.Current.Argument & 0xFF);
    let kwparamList = [];
    let pparamList = [];
    for (let idx = 0; idx < kwparams; idx++) {
        let value = this.dataStack.pop();
        let key = this.dataStack.pop();
        kwparamList.unshift({key, value});
    }
    for (let idx = 0; idx < pparams; idx++) {
        pparamList.unshift(this.dataStack.pop());
    }
    let func = this.dataStack.pop();

    let callNode = new AST.ASTCall( func, pparamList, kwparamList);
    callNode.kw = kw;
    callNode.var = variable;
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleCallMethodA() {
    let pparamList = [];
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        let param = this.dataStack.pop();
        if (param instanceof AST.ASTFunction) {
            let fun_code = param.code;
            let code_src = fun_code.object;
            let function_name = code_src.name;
            if (function_name == "<lambda>") {
                pparamList.unshift(param);
            } else {
                // Decorator used
                let decorNameNode = new AST.ASTName(function_name);
                let storeNode = new AST.ASTStore(param, decorNameNode);
                storeNode.line = this.code.Current.LineNo;
                this.curBlock.nodes.push(storeNode);

                pparamList.unshift(decorNameNode);
            }
        } else {
            pparamList.unshift(param);
        }
    }
    let func = this.dataStack.pop();
    let callNode = new AST.ASTCall (func, pparamList, []);
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handlePrecallA() {}

function handleBinaryCall() {
    let paramsTuple = this.dataStack.pop();
    let func = this.dataStack.pop();
    let params = [];

    if (paramsTuple instanceof AST.ASTTuple) {
        params = paramsTuple.values;
    }

    let callNode = new AST.ASTCall(func, params);
    this.dataStack.push(callNode);
}

function handleCallFunctionExA() {
    // CPython 3.6+: oparg & 0x01 means kwargs mapping is on TOS; the positional
    // tuple and the callable are ALWAYS popped regardless of the flag.
    let flags = this.code.Current.Argument;
    let kwparams = [];
    let pparams = [];
    let varArg = null;
    let kwSpread = null;
    let kwSingle = null;
    if (flags & 0x01) { // **kwargs
        let kw = this.dataStack.pop();
        if (kw instanceof AST.ASTMapUnpack) {
            // Py 3.6+ f(**a, **b) path: preserve individual ** sources for rendering.
            kwSpread = kw;
        } else if (kw instanceof AST.ASTMap) {
            kwparams = kw.values;
        } else if (kw?.object?.ClassName === "Py_Dict" && kw.object.Value) {
            kwparams = kw.object.Value.map(entry => ({key: new AST.ASTObject(entry.key), value: new AST.ASTObject(entry.value)}));
        } else {
            // Single **dict argument where dict is a name/expression (not literal).
            kwSingle = kw;
        }
    }
    let args = this.dataStack.pop();
    if (args instanceof AST.ASTTuple || args instanceof AST.ASTList) {
        pparams = args.values;
    } else {
        // *args as a non-literal expression (e.g. f(*tup_name, **kw)).
        varArg = args;
    }
    let func = this.dataStack.pop();
    let callNode = new AST.ASTCall(func, pparams, kwparams);
    if (varArg) {
        callNode.var = varArg;
    }
    if (kwSpread) {
        callNode.kw = kwSpread;
    } else if (kwSingle) {
        callNode.kw = kwSingle;
    }
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleCallIntrinsic1() {
    // Python 3.12+ CALL_INTRINSIC_1 opcode
    // Calls built-in intrinsic functions (argument specifies which)
    // Intrinsic 3: ASYNC_GEN_WRAP (wraps async generator function)
    // Intrinsic 4: STOPITERATION_ERROR, etc.

    // Intrinsic takes 1 arg from stack, returns result
    let arg = this.dataStack.pop();

    if (global.g_cliArgs?.debug) {
        console.log(`[CALL_INTRINSIC_1] intrinsic=${this.code.Current.Argument}, arg=${arg?.constructor?.name}`);
    }

    // Intrinsic 11 (PEP 695 type statement) wraps a tuple(name, qualname, type-fn)
    const TYPE_ALIAS_INTRINSIC = 11;
    if (this.code.Current.Argument === TYPE_ALIAS_INTRINSIC && arg instanceof AST.ASTTuple) {
        const values = arg.values || [];
        const aliasName = values[0]?.object?.Value || values[0]?.name || values[0]?.codeFragment?.();
        const typeFunc = values[2];
        const extractTypeValue = (fn) => {
            if (!(fn instanceof AST.ASTFunction)) {
                return fn;
            }
            const body = fn.code?.object?.SourceCode;
            if (body?.list?.length) {
                const first = body.list[0];
                if (first instanceof AST.ASTReturn) {
                    return first.value;
                }
                return first;
            }
            return fn;
        };
        const typeValue = extractTypeValue(typeFunc);
        if (typeValue instanceof AST.ASTSubscr && typeValue.key instanceof AST.ASTTuple) {
            typeValue.key.m_requireParens = false;
        }
        const aliasNode = new AST.ASTTypeAlias(aliasName, typeValue);
        aliasNode.line = this.code.Current.LineNo;
        this.dataStack.push(aliasNode);
        return;
    }

    // Default: preserve the argument as result
    if (arg) {
        this.dataStack.push(arg);
    }
}

function handleCallIntrinsic2() {
    // Python 3.12+ CALL_INTRINSIC_2 opcode
    // Calls intrinsics with 2 arguments

    if (global.g_cliArgs?.debug) {
        console.log(`[CALL_INTRINSIC_2] intrinsic=${this.code.Current.Argument}`);
    }

    const argB = this.dataStack.pop();
    const argA = this.dataStack.pop();
    const args = [argA, argB];

    // Intrinsic 1: PREP_RERAISE_STAR equivalent in 3.12+.
    // Do not emit; mark to skip the following conditional jump.
    if (this.code.Current.Argument === 1) {
        this.ignoreNextConditional = true;
        this.cleanupStackDepth = this.dataStack.length + 1; // after we push a placeholder
        this.dataStack.push(new AST.ASTNone());
        this.inExceptionGroup = true;
        return;
    }

    // Intrinsic 4: build generic function from type parameters + function
    if (this.code.Current.Argument === 4) {
        const funcNode = args.find(a => a instanceof AST.ASTFunction);
        const typeArg = args.find(a => a instanceof AST.ASTTuple || a instanceof AST.ASTList);
        if (funcNode && typeArg) {
            const names = (typeArg.values || []).map(v => {
                if (v instanceof AST.ASTName) return v.name;
                if (v?.object?.Value) return v.object.Value;
                const frag = v?.codeFragment?.();
                return frag?.toString?.() || 'T';
            });
            funcNode.typeParams = names;
            this.dataStack.push(funcNode);
            return;
        }
    }

    // Default: preserve the left argument to avoid stack underflow
    if (argA !== undefined) {
        this.dataStack.push(argA);
    }
}

function handleCallIntrinsic1A() {
    // Python 3.12+ CALL_INTRINSIC_1_A opcode (wrapper)
    handleCallIntrinsic1.call(this);
}

function handleCallIntrinsic2A() {
    // Python 3.12+ CALL_INTRINSIC_2_A opcode (wrapper)
    handleCallIntrinsic2.call(this);
}

module.exports = {
    handleKwNamesA,
    handleCallA,
    handleCallKwA,
    handleInstrumentedCallKwA,
    handleCallFunctionA,
    handleInstrumentedCallA,
    handleCallFunctionVarA,
    handleCallFunctionKwA,
    handleCallFunctionVarKwA,
    handleCallMethodA,
    handlePrecallA,
    handleBinaryCall,
    handleCallFunctionExA,
    handleCallIntrinsic1,
    handleCallIntrinsic2,
    handleCallIntrinsic1A,
    handleCallIntrinsic2A,
    handleEnterExecutorA
};
