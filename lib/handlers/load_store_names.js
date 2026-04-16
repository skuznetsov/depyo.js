const PycDecompiler = require('../PycDecompiler');
const AST = require('../ast/ast_node');
const { beginMatchCaseFromPattern } = require('./misc_other');

function handleDeleteAttrA() {
    let name = this.dataStack.pop();
    let node = new AST.ASTDelete(new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteGlobalA() {
    this.object.Globals.add(this.code.Current.Name);
    handleDeleteNameA.call(this);
}

function handleDeleteNameA() {
    let varname = this.code.Current.Name || "";

    if (!varname.length) {
        return;
    }

    if (varname.length >= 2 && varname.startsWith('_[')) {
        /* Don't show deletes that are a result of list comps.
         * Clear the _listCompAppendRefs cache so the next FOR_ITER outside
         * this listcomp doesn't mistake itself for one. */
        if (this._listCompAppendRefs) {
            delete this._listCompAppendRefs[varname];
        }
        return;
    }

    let node = new AST.ASTDelete(new AST.ASTName(varname));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteFastA() {
    let nameVal = this.code.Current.Name || "";
    if (!nameVal.length) {
        return;
    }
    let nameNode = new AST.ASTName(nameVal);

    if (nameNode.name.startsWith('_[')) {
        /* Don't show deletes that are a result of list comps.
         * Clear the _listCompAppendRefs cache so the next FOR_ITER outside
         * this listcomp doesn't mistake itself for one. */
        if (this._listCompAppendRefs) {
            delete this._listCompAppendRefs[nameNode.name];
        }
        return;
    }

    let node = new AST.ASTDelete(nameNode);
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteDerefA() {
    const freeName = this.code.Current.FreeName || "";
    if (!freeName) {
        return;
    }
    let node = new AST.ASTDelete(new AST.ASTName(freeName));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleLoadAttrA() {
    let name = this.dataStack.top();
    if (!(name instanceof AST.ASTImport)) {
        this.dataStack.pop();

        if (this.object.Reader.versionCompare(3, 12) >= 0) {
            if (this.code.Current.Argument & 1) {
                /* Changed in version 3.12:
                If the low bit of namei is set, then a null or self is pushed to the stack
                before the attribute or unbound method respectively. */
                this.dataStack.push(null);
            }
            this.code.Current.Argument >>= 1;
        }

        let node = new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }
}

function handleLoadConstA() {
    let constantObject = new AST.ASTObject(this.code.Current.ConstantObject);
    constantObject.line = this.code.Current.LineNo;

    if (global.g_cliArgs?.debug) {
        let value = constantObject.object?.ClassName == 'Py_String' ? constantObject.object.Value : constantObject.object?.ClassName;
        console.log(`[LOAD_CONST] offset=${this.code.Current.Offset}, arg=${this.code.Current.Argument}, value=${value}`);
    }

    if (constantObject.object == null || constantObject.object.ClassName == "Py_None") {
        this.dataStack.push(new AST.ASTNone());
    } else if ((constantObject.object.ClassName == "Py_Tuple" ||
            constantObject.object.ClassName == "Py_SmallTuple") &&
            constantObject.object.Value.empty()) {
        let node = new AST.ASTTuple ([]);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    } else {
        this.dataStack.push(constantObject);
    }
}

function handleLoadDerefA() {
    processLoadDeref.call(this);
}

function handleLoadClassderefA() {
    processLoadDeref.call(this);
}

function processLoadDeref() {
    let varName = this.code.Current.FreeName || "";
    if (varName.length >= 2 && varName.startsWith('_[')) {
        const cached = this._listCompAppendRefs?.[varName];
        if (cached) {
            this.dataStack.push(cached);
        }
        return;
    }
    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadFastA() {
    let varName = this.code.Current.Name || "";
    if (varName.length >= 2 && varName.startsWith('_[')) {
        // Pre-LIST_APPEND comprehensions (Python 2.3) cache `list.append` in
        // the synthetic `_[N]` slot and re-load it to call per iteration.
        // Replay the stored expression so CALL_FUNCTION has a real callable
        // instead of falling through to `##ERROR##`.
        const cached = this._listCompAppendRefs?.[varName];
        if (cached) {
            this.dataStack.push(cached);
        }
        return;
    }

    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadFastCheckA() {
    // Python 3.12+: same semantics as LOAD_FAST for reconstruction.
    handleLoadFastA.call(this);
}

function handleLoadGlobalA() {
    let varName = this.code.Current.Name || "";
    if (varName.length >= 2 && varName.startsWith('_[')) {
        const cached = this._listCompAppendRefs?.[varName];
        if (cached) {
            this.dataStack.push(cached);
        }
        return;
    }

    if (this.object.Reader.versionCompare(3, 11) >= 0) {
        // Loads the global named co_names[namei>>1] onto the this.dataStack.
        if (this.code.Current.Argument & 1) {
            /* Changed in version 3.11: 
            If the low bit of "NAMEI" (this.code.Current.Argument) is set, 
            then a null is pushed to the stack before the global variable. */
            this.dataStack.push(null);
        }
        this.code.Current.Argument >>= 1;
    }
    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadFromDictOrDerefA() {
    // Python 3.12+: LOAD_FROM_DICT_OR_DEREF consumes the locals dict from TOS
    // (pushed by the preceding LOAD_LOCALS) and resolves the name against it,
    // falling back to the deref cell. The argument is a localsplus index into
    // [VarNames | CellVars | FreeVars] — use FreeName which the opcode reader
    // resolved via that table.
    if (this.dataStack.top() instanceof AST.ASTLocals) {
        this.dataStack.pop();
    }
    const varName = this.code.Current.FreeName || this.code.Current.Name || "";
    if (!varName.length) {
        return;
    }
    let node = new AST.ASTName(varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadLocals() {
    let node = new AST.ASTLocals ();
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleStoreLocals() {
    this.dataStack.pop();
}

function handleLoadMethodA() {
    // Behave like LOAD_ATTR
    let name = this.dataStack.pop();
    let node = new AST.ASTBinary (name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadNameA() {
    let varName = this.code.Current.Name || "";
    if (varName.length >= 2 && varName.startsWith('_[')) {
        const cached = this._listCompAppendRefs?.[varName];
        if (cached) {
            this.dataStack.push(cached);
        }
        return;
    }
    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

// Python 3.14 LOAD_SPECIAL oparg-to-method mapping (from pycore_ceval.h)
const SPECIAL_METHOD_NAMES = {
    0: "__enter__",
    1: "__exit__",
    2: "__aenter__",
    3: "__aexit__"
};

function handleLoadSpecialA() {
    // Python 3.14 LOAD_SPECIAL: oparg indexes into special method table.
    // Per CPython docs: pushes (method, self) pair onto stack.
    // - For methods: [type(obj).__xxx__, obj]
    // - For non-methods: [obj.__xxx__, NULL]
    let obj = this.dataStack.pop();
    const oparg = this.code.Current.Argument || 0;
    const attrName = SPECIAL_METHOD_NAMES[oparg] || `__special_${oparg}__`;
    if (!obj) {
        obj = new AST.ASTName("##MISSING##");
    }

    // For __exit__ (oparg 1): save the context manager expression for with-block
    // This is called BEFORE __enter__ in 3.14 bytecode pattern
    if (oparg === 1) {
        this._py314WithContextMgr = obj;
    }

    // For __enter__ (oparg 0): create with-block using saved context manager
    if (oparg === 0) {
        // Get the saved context manager from when __exit__ was loaded
        const ctxMgr = this._py314WithContextMgr || obj;

        // Find with block end from exception table
        let withEnd = this.code.LastOffset;
        const exceptionTable = this.object.ExceptionTable || [];
        const currentOffset = this.code.Current.Offset;

        for (const entry of exceptionTable) {
            if (entry.start > currentOffset && entry.start <= currentOffset + 20) {
                withEnd = entry.end || withEnd;
                entry._isWithStatement = true;
                break;
            }
        }

        // Create the WITH block (don't set expr - let STORE do it via _py314WithCtxMgrForStore)
        let withBlock = new AST.ASTWithBlock(currentOffset, withEnd);

        // Push the with block onto the block stack
        this.blocks.push(withBlock);
        this.curBlock = this.blocks.top();

        // Save context manager for CALL to push to stack (so STORE gets it as valueNode)
        this._py314WithCtxMgrForStore = ctxMgr;

        // Clear the temporary from __exit__
        this._py314WithContextMgr = null;
    }

    let method = new AST.ASTBinary(obj, new AST.ASTName(attrName), AST.ASTBinary.BinOp.Attr);
    method.line = this.code.Current.LineNo;
    // Push self_or_null and callable to match CALL convention:
    // Stack layout for CALL: [self_or_null, callable, args...]
    // For method from LOAD_SPECIAL: self_or_null=obj, callable=method
    this.dataStack.push(obj);     // self_or_null (TOS-1 for CALL)
    this.dataStack.push(method);  // callable (TOS for CALL pops this first)
}

function handleLoadSuperAttrA() {
    // Python 3.12+ LOAD_SUPER_ATTR uses flags in argument to encode self/null.
    // Treat as attribute access on super(): super().<name>
    const attr = new AST.ASTName(this.code.Current.Name || "");
    const superCall = new AST.ASTCall(new AST.ASTName("super"), [], []);
    const node = new AST.ASTBinary(superCall, attr, AST.ASTBinary.BinOp.Attr);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadSuperMethodA() {
    // Similar to LOAD_SUPER_ATTR; represent as super().<name>
    handleLoadSuperAttrA.call(this);
}

function handleLoadZeroSuperAttrA() {
    // Zero-cost variants; reuse super attr logic.
    handleLoadSuperAttrA.call(this);
}

function handleLoadZeroSuperMethodA() {
    handleLoadSuperAttrA.call(this);
}

function handleStoreAttrA() {
    if (this.unpack) {
        let name = this.dataStack.pop();
        let attrNode = new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);

        let tup = this.dataStack.top();
        if (tup instanceof AST.ASTTuple) {
            tup.add(attrNode);
        } else {
            if (global.g_cliArgs?.debug) {
                console.error("Something TERRIBLE happened!\n");
            }
        }

        if (--this.unpack <= 0) {
            this.dataStack.pop();
            let seqNode = this.dataStack.pop();
            if (seqNode instanceof AST.ASTChainStore) {
                seqNode.line = this.code.Current.LineNo;
                this.append_to_chain_store(seqNode, tup);
            } else {
                let node = new AST.ASTStore(seqNode, tup);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    } else {
        let name = this.dataStack.pop();
        let value = this.dataStack.pop();
        let attrNode = new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);
        if (value instanceof AST.ASTChainStore) {
            this.append_to_chain_store(value, attrNode);
        } else {
            let node = new AST.ASTStore(value, attrNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }
}

function handleStoreDerefA() {
    if (this.unpack) {
        let nameNode = new AST.ASTName(this.code.Current.FreeName);
        let tupleNode = this.dataStack.top();
        if (tupleNode instanceof AST.ASTTuple)
            tupleNode.add(nameNode);
        else if (global.g_cliArgs?.debug)
            console.error("Something TERRIBLE happened!\n");

        if (--this.unpack <= 0) {
            this.dataStack.pop();
            let seqNode = this.dataStack.pop();

            if (seqNode instanceof AST.ASTChainStore) {
                seqNode.line = this.code.Current.LineNo;
                this.append_to_chain_store(seqNode, tupleNode);
            } else {
                let node = new AST.ASTStore(seqNode, tupleNode);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    } else {
        let nameNode = new AST.ASTName(this.code.Current.FreeName);

        // Closure-captured for-loop variable: STORE_DEREF to a cell var while an
        // uninitialized For block is on the stack means this is the loop index,
        // not an assignment. Py 3.0 classes with decorators closing over the
        // loop variable use this pattern (STORE_DEREF for the captured name,
        // STORE_FAST for the class afterwards).
        let parentForBlock = null;
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            if ((this.blocks[i].blockType == AST.ASTBlock.BlockType.For ||
                 this.blocks[i].blockType == AST.ASTBlock.BlockType.AsyncFor) &&
                !this.blocks[i].inited) {
                parentForBlock = this.blocks[i];
                break;
            }
        }
        if (parentForBlock) {
            parentForBlock.index = nameNode;
            parentForBlock.init();
            return;
        }

        let valueNode = this.dataStack.pop();

        if (valueNode instanceof AST.ASTChainStore) {
            this.append_to_chain_store(valueNode, nameNode);
        } else {
            let node = new AST.ASTStore(valueNode, nameNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }
}

function handleStoreFastA() {
    processStore.call(this);
}

function handleStoreGlobalA() {
    processStore.call(this);
}

function handleStoreNameA() {
    processStore.call(this);
}

function handleStoreAnnotationA() {
    // Python 3.6 only: pops the annotation type and stores it under
    // __annotations__[name]. The variable name is the opcode argument.
    // Patterns:
    //   `x: int`        → LOAD_NAME int ; STORE_ANNOTATION x
    //   `x: int = 1`    → LOAD_CONST 1 ; STORE_NAME x ; LOAD_NAME int ; STORE_ANNOTATION x
    const annType = this.dataStack.pop();
    const varName = this.code.Current.Name || "";
    const nameNode = new AST.ASTName(varName);

    const last = this.curBlock.nodes.top();
    if (last instanceof AST.ASTStore &&
        last.dest instanceof AST.ASTName &&
        last.dest.name === varName) {
        // Combine prior `x = value` with annotation → `x: int = value`
        const annotated = new AST.ASTAnnotatedVar(nameNode, annType);
        annotated.line = this.code.Current.LineNo;
        last.dest = annotated;
    } else {
        // Standalone annotation `x: int`
        const annotated = new AST.ASTAnnotatedVar(nameNode, annType);
        annotated.line = this.code.Current.LineNo;
        this.curBlock.append(annotated);
    }
}

function processStore(nameOverride) {
    const currentName = nameOverride !== undefined ? nameOverride : this.code.Current.Name;

    // Pattern matching: first capture expected bindings, then start case body
    if (this.inMatchPattern) {
        if (shouldCaptureStoreInPattern(this.patternOps)) {
            this.patternOps.push({
                type: 'STORE_FAST',
                name: currentName
            });
            return;
        }

        if (beginMatchCaseFromPattern.call(this, {reason: 'store'})) {
            this.unpack = 0;
            this.starPos = -1;
            // Fall through to normal store handling now that case body started
        }
    }

    if (global.g_cliArgs?.debug && currentName && (currentName === 'b' || currentName === 'i')) {
        console.log(`[processStore] varName=${currentName}, curBlock=${this.curBlock.type_str}, inited=${this.curBlock.inited}, unpack=${this.unpack}`);
        console.log(`  Block stack: ${this.blocks.map((b,i) => `[${i}]${b.type_str}(inited=${b.inited})`).join(' → ')}`);
    }

    // Check if we're inside an uninitialized For/AsyncFor block (could be nested inside try/container)
    let parentForBlock = null;
    for (let i = this.blocks.length - 1; i >= 0; i--) {
        if ((this.blocks[i].blockType == AST.ASTBlock.BlockType.For ||
             this.blocks[i].blockType == AST.ASTBlock.BlockType.AsyncFor) &&
            !this.blocks[i].inited) {
            parentForBlock = this.blocks[i];
            break;
        }
    }

    if (this.unpack) {
        let nameNode = new AST.ASTName(currentName);

        let tupleNode = this.dataStack.top();
        if (tupleNode instanceof AST.ASTTuple) {
            if (this.starPos-- == 0) {
                nameNode.name = '*' + nameNode.name;
            }
            tupleNode.add(nameNode);
        } else {
            if (global.g_cliArgs?.debug) {
                console.error("Something TERRIBLE happened!\n");
            }
        }
        
        if (--this.unpack <= 0) {
            this.dataStack.pop();
            let seqNode = this.dataStack.pop();

            if (parentForBlock) {
                let tuple = tupleNode;
                if (tuple != null) {
                    tuple.requireParens = false;
                }
                parentForBlock.index = tupleNode;
                parentForBlock.init();
            } else if (seqNode instanceof AST.ASTChainStore) {
                seqNode.line = this.code.Current.LineNo;
                this.append_to_chain_store(seqNode, tupleNode);
            } else {
                let node = new AST.ASTStore(seqNode, tupleNode);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    } else {
        let varName = currentName || "";
        if (varName.length >= 2 && varName.startsWith('_[')) {
            /* Synthetic `_[N]` is CPython bookkeeping; never in real source.
             * Listcomp case: Py2.3 stores `list.append`, Py2.4-2.6 stores
             *   the list itself. Pop + cache so later LOAD can replay.
             * Pre-PEP-343 `with` (2.5+) also uses `_[N]` to park __exit__ /
             *   __enter__() result. Those are consumed by downstream opcodes
             *   walking the stack backwards — we must NOT pop in that case.
             * Heuristic: if stack top matches listcomp shape, swallow. Else
             * leave stack untouched so the with-handler's backward scan still
             * sees the real expressions. */
            const top = this.dataStack[this.dataStack.length - 1];
            const isListcompList = top instanceof AST.ASTList;
            const isListcompAppend = top instanceof AST.ASTBinary
                && top.op === AST.ASTBinary.BinOp.Attr
                && top.right instanceof AST.ASTName
                && top.right.name === "append";
            if (isListcompList || isListcompAppend) {
                this.dataStack.pop();
                this._listCompAppendRefs = this._listCompAppendRefs || {};
                this._listCompAppendRefs[varName] = top;
            }
            return;
        }

        // Return private names back to their original name
        let class_prefix = "_" + varName;
        if (varName.startsWith(class_prefix + "__")) {
            varName.value = varName.substring(class_prefix.length);
        }

        let nameNode = new AST.ASTName(varName);
        nameNode.line = this.code.Current.LineNo;

        // Handle walrus operator (named expression): (n := 10)
        if (this.isWalrusOperator) {
            let valueNode = this.dataStack.pop();
            let namedExpr = new AST.ASTNamedExpr(nameNode, valueNode);
            namedExpr.line = this.code.Current.LineNo;
            this.dataStack.push(namedExpr);
            this.isWalrusOperator = false;
            return;
        }

        if (parentForBlock) {
            if (global.g_cliArgs?.debug && parentForBlock.blockType == AST.ASTBlock.BlockType.AsyncFor) {
                console.log(`[processStore] Setting AsyncFor index to: ${varName}`);
            }
            parentForBlock.index = nameNode;
            parentForBlock.init();
        } else {
            let valueNode = this.dataStack.pop();
            // DUP_TOP for chain assign leaves [V, V, ChainStore] on the
            // stack, so the ChainStore is popped here as `valueNode` rather
            // than being the second-from-top importNode checked below.
            if (valueNode instanceof AST.ASTChainStore) {
                this.dataStack.pop(); // consume the extra duplicate V
                this.append_to_chain_store(valueNode, nameNode);
                if (this.code.Prev?.OpCodeID != this.OpCodes.DUP_TOP &&
                    this.code.Prev?.OpCodeID != this.OpCodes.COPY_A) {
                    // Terminal store — commit chainstore to block and
                    // clear the copy append_to_chain_store just pushed.
                    if (this.dataStack.top() === valueNode) {
                        this.dataStack.pop();
                    }
                    this.curBlock.append(valueNode);
                }
                return;
            }
            let importNode = this.dataStack.top();
            if (importNode instanceof AST.ASTImport) {
                let storeNode = new AST.ASTStore(valueNode, nameNode);
                storeNode.line = this.code.Current.LineNo;
                importNode.add_store?.(storeNode);
                return;
            } else if (importNode instanceof AST.ASTChainStore) {
                // fall through after reusing valueNode
                this.dataStack.pop(); // remove chain store from stack
                this.append_to_chain_store(importNode, nameNode);
                if (this.code.Prev?.OpCodeID != this.OpCodes.DUP_TOP) {
                    this.curBlock.append(importNode);
                }
                return;
            } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.With
                        && !this.curBlock.inited) {
                this.curBlock.expr = valueNode;
                this.curBlock.var = nameNode;
                this.curBlock.init();
                return;
            }

            if (!valueNode) {
                valueNode = new AST.ASTNone();
            }
            if (valueNode instanceof AST.ASTFunction && !valueNode.code.object.SourceCode) {
                let decompiler = new PycDecompiler(valueNode.code.object);
                valueNode.code.object.SourceCode = decompiler.decompile();
                if (decompiler.errors.length) this.errors.push(...decompiler.errors);
            }
            let lastBlockNode = this.curBlock.nodes.top();
            if (
                lastBlockNode instanceof AST.ASTCondBlock &&
                lastBlockNode.nodes.length == 0 &&
                this.code.Current.LineNo == lastBlockNode.line &&
                lastBlockNode.line == valueNode.line
            ) {
                valueNode = new AST.ASTBinary(lastBlockNode.condition, valueNode, lastBlockNode.negative ? AST.ASTBinary.BinOp.LogicalOr : AST.ASTBinary.BinOp.LogicalAnd);
                this.curBlock.nodes.pop();
            }
            let node = new AST.ASTStore(valueNode, nameNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }

        if (this.code.Current.OpCodeID == this.OpCodes.STORE_GLOBAL_A) {
            this.object.Globals.add(nameNode.name);
        }
    }
}

function shouldCaptureStoreInPattern(patternOps) {
    patternOps = patternOps || [];
    const expected = getExpectedPatternStoreCount(patternOps);
    if (expected == null) {
        return true;
    }
    const recorded = patternOps.filter(op => op.type === 'STORE_FAST').length;
    return recorded < expected;
}

function getExpectedPatternStoreCount(patternOps) {
    const matchClassOp = patternOps.find(op => op.type === 'MATCH_CLASS');
    if (matchClassOp) {
        if (matchClassOp.attrNames && matchClassOp.attrNames.length) {
            return matchClassOp.attrNames.length;
        }
        if (matchClassOp.count) {
            return matchClassOp.count;
        }
        return 0;
    }

    const unpackOp = patternOps.find(op => op.type === 'UNPACK_SEQUENCE');
    if (unpackOp) {
        return unpackOp.count;
    }

    return null;
}

function handleReserveFastA() {
    let list = [];
    this.code.Current.ConstantObject.Value.map(el => list[el.value] = el.key);
    this.dataStack.push(list);
}

function handleLoadFastAndClearA() {
    // Python 3.12+ inline comprehension save pattern:
    //   LOAD_FAST_AND_CLEAR var ; SWAP 2 ; BUILD_<LIST|SET|MAP> 0 ; SWAP 2 ; (GET_ITER)? ; FOR_ITER
    // CPython inlines comprehensions into the parent scope, saving the loop var
    // before and restoring after. Skip the save here so the comprehension stack
    // matches the simpler BUILD/SWAP/GET_ITER/FOR_ITER shape; END_FOR cleans up.
    const next1 = this.code.Next;
    const next2 = next1?.Next;
    const next3 = next2?.Next;
    const isCompStart = next1?.OpCodeID == this.OpCodes.SWAP_A && next1.Argument == 2 &&
                        (next2?.OpCodeID == this.OpCodes.BUILD_LIST_A ||
                         next2?.OpCodeID == this.OpCodes.BUILD_SET_A ||
                         next2?.OpCodeID == this.OpCodes.BUILD_MAP_A) &&
                        next2.Argument == 0 &&
                        next3?.OpCodeID == this.OpCodes.SWAP_A && next3.Argument == 2;
    if (isCompStart) {
        this._inlineCompSavedVar = this.code.Current.Name;
        this.code.GoNext(); // consume the SWAP 2 right after this op
        return;
    }
    handleLoadFastA.call(this);
}

function handleLoadFastBorrowA() {
    // Python 3.14+ LOAD_FAST_BORROW - optimized LOAD_FAST
    handleLoadFastA.call(this);
}

function handleLoadFastBorrowLoadFastBorrowA() {
    // Python 3.15+ packed borrow load (same encoding as LOAD_FAST_LOAD_FAST).
    handleLoadFastLoadFastA.call(this);
}

function handleLoadCommonConstantA() {
    // Python 3.14+ common constants table
    const {PythonObject} = require('../PythonObject');
    const mapping = {
        0: () => new AST.ASTNone(),
        1: () => new AST.ASTObject(new PythonObject("Py_Bool", false)),
        2: () => new AST.ASTObject(new PythonObject("Py_Bool", true)),
        3: () => new AST.ASTObject(new PythonObject("Py_Int", -1)),
        4: () => new AST.ASTObject(new PythonObject("Py_Int", 0)),
        5: () => new AST.ASTObject(new PythonObject("Py_Int", 1)),
        6: () => new AST.ASTObject(new PythonObject("Py_Int", 2)),
        7: () => new AST.ASTObject(new PythonObject("Py_Int", 3)),
        8: () => new AST.ASTObject(new PythonObject("Py_Int", 4)),
        9: () => new AST.ASTObject(new PythonObject("Py_Int", 5))
    };
    const maker = mapping[this.code.Current.Argument];
    let node = maker ? maker() : new AST.ASTName(`__common_const_${this.code.Current.Argument}__`);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadFastLoadFastA() {
    // CPython pushes local[hi] then local[lo]. For 3.13 the two halves are packed
    // nibble-wise in the argument (hi in upper nibble, lo in lower nibble);
    // older bytecode used bytes.
    const packed = this.code.Current.Argument;
    const isPackedNibbles = this.object?.Reader?.versionCompare(3, 13) >= 0;
    const hiIdx = isPackedNibbles ? ((packed >> 4) & 0x0F) : ((packed >> 8) & 0xFF);
    const loIdx = isPackedNibbles ? (packed & 0x0F) : (packed & 0xFF);
    const varNames = this.object?.VarNames?.Value || this.object?.code?.object?.VarNames?.Value || [];
    const hiName = varNames[hiIdx]?.toString?.() || `##var_${hiIdx}##`;
    const loName = varNames[loIdx]?.toString?.() || `##var_${loIdx}##`;
    this.dataStack.push(new AST.ASTName(hiName));
    this.dataStack.push(new AST.ASTName(loName));
}

function handleStoreFastLoadFastA() {
    // CPython: store TOS into local[hi], then push local[lo].
    const packed = this.code.Current.Argument;
    const isPackedNibbles = this.object?.Reader?.versionCompare(3, 13) >= 0;
    const storeIdx = isPackedNibbles ? ((packed >> 4) & 0x0F) : ((packed >> 8) & 0xFF);
    const loadIdx = isPackedNibbles ? (packed & 0x0F) : (packed & 0xFF);
    const varNames = this.object?.VarNames?.Value || this.object?.code?.object?.VarNames?.Value || [];
    const storeName = varNames[storeIdx]?.toString?.() || `##var_${storeIdx}##`;
    const loadName = varNames[loadIdx]?.toString?.() || `##var_${loadIdx}##`;

    if (this.inMatchPattern && shouldCaptureStoreInPattern(this.patternOps)) {
        this.dataStack.pop();
        this.patternOps.push({type: 'STORE_FAST', name: storeName});
        this.dataStack.push(new AST.ASTName(loadName));
        return;
    }

    // Route STORE through processStore so for-block target / unpack / chain-store work.
    processStore.call(this, storeName);
    this.dataStack.push(new AST.ASTName(loadName));
}

function handleStoreFastStoreFastA() {
    // CPython: stack is [value2, value1] with value1 on TOS.
    // SETLOCAL(hi, value1); SETLOCAL(lo, value2).
    const packed = this.code.Current.Argument;
    const isPackedNibbles = this.object?.Reader?.versionCompare(3, 13) >= 0;
    const hiIdx = isPackedNibbles ? ((packed >> 4) & 0x0F) : ((packed >> 8) & 0xFF);
    const loIdx = isPackedNibbles ? (packed & 0x0F) : (packed & 0xFF);
    const varNames = this.object?.VarNames?.Value || this.object?.code?.object?.VarNames?.Value || [];
    const hiName = varNames[hiIdx]?.toString?.() || `##var_${hiIdx}##`;
    const loName = varNames[loIdx]?.toString?.() || `##var_${loIdx}##`;

    // Delegate to processStore so unpack / for-target / chain-store paths work.
    // First store consumes TOS (high nibble target), second store consumes new TOS.
    processStore.call(this, hiName);
    processStore.call(this, loName);
}

function handleLoadSmallIntA() {
    // Python 3.14+ LOAD_SMALL_INT - loads small integer constant
    const PythonObject = require('../PythonObject').PythonObject;
    let value = this.code.Current.Argument;
    let node = new AST.ASTObject(new PythonObject("Py_Int", value));
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

module.exports = {
    handleDeleteAttrA,
    handleDeleteGlobalA,
    handleDeleteNameA,
    handleDeleteFastA,
    handleDeleteDerefA,
    handleLoadAttrA,
    handleLoadConstA,
    handleLoadDerefA,
    handleLoadClassderefA,
    handleLoadFastA,
    handleLoadFastCheckA,
    handleLoadFastAndClearA,
    handleLoadFastBorrowA,
    handleLoadFastBorrowLoadFastBorrowA,
    handleLoadFastLoadFastA,
    handleLoadGlobalA,
    handleLoadCommonConstantA,
    handleLoadLocals,
    handleLoadSmallIntA,
    handleStoreLocals,
    handleLoadMethodA,
    handleLoadNameA,
    handleLoadSpecialA,
    handleLoadSuperAttrA,
    handleLoadSuperMethodA,
    handleLoadZeroSuperAttrA,
    handleLoadZeroSuperMethodA,
    handleLoadFromDictOrDerefA,
    handleStoreAttrA,
    handleStoreDerefA,
    handleStoreFastA,
    handleStoreFastLoadFastA,
    handleStoreFastStoreFastA,
    handleStoreGlobalA,
    handleStoreNameA,
    handleStoreAnnotationA,
    handleReserveFastA
};
