const PycObject = require('../PythonObject').PythonObject;
const PycDecompiler = require('../PycDecompiler');
const AST = require('../ast/ast_node');

function handleBuildFunction() {
    let functionCode = this.dataStack.pop();
    let functionNode = new AST.ASTFunction(functionCode);
    this.dataStack.push(functionNode);
}

function handleBuildListA() {
    let values = [];

    for (let idx = this.code.Current.Argument - 1; idx >= 0; idx--) {
        values[idx] = this.dataStack.pop();
    }

    let listNode = new AST.ASTList(values);
    this.dataStack.push(listNode);
}

function handleBuildSetA() {
    let values = [];

    for (let idx = this.code.Current.Argument - 1; idx >= 0; idx--) {
        values[idx] = this.dataStack.pop();
    }

    let listNode = new AST.ASTSet(values);
    this.dataStack.push(listNode);
    if (this.code.Next?.OpCodeID == this.OpCodes.DUP_TOP) {
        this.code.GoNext();
    }
}

function handleBuildClass() {
    let classCode = this.dataStack.pop();
    let bases = this.dataStack.pop();
    let name = this.dataStack.pop();
    let classNode = new AST.ASTClass(classCode, bases, name);
    this.dataStack.push(classNode);
}

function handleLoadBuildClass() {
    let node = new AST.ASTLoadBuildClass (new PycObject());
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleMakeClosureA() {
    processMakeFunction.call(this);
}

function handleMakeFunction() {
    processMakeFunction.call(this);
}

function handleMakeFunctionA() {
    processMakeFunction.call(this);
}

function handleMakeCellA() {
    // In 3.11+ the argument is an index into localsplus ([locals | cells | frees]).
    // Prefer the already-computed FreeName when available; otherwise fall back to
    // VarNames + CellVars + FreeVars lookup.
    const arg = this.code.Current.Argument;
    let name = this.code.Current.FreeName;
    if (!name) {
        const varNames = this.object?.VarNames?.Value || [];
        const cellVars = this.object?.CellVars?.Value || [];
        const freeVars = this.object?.FreeVars?.Value || [];
        if (arg < varNames.length) {
            name = varNames[arg]?.toString?.();
        } else if (arg - varNames.length < cellVars.length) {
            name = cellVars[arg - varNames.length]?.toString?.();
        } else if (arg - varNames.length - cellVars.length < freeVars.length) {
            name = freeVars[arg - varNames.length - cellVars.length]?.toString?.();
        }
    }
    if (!name) name = `##cell_${arg}##`;
    this.dataStack.push(new AST.ASTName(name));
}

function handleSetFunctionAttributeA() {
    // Stack: [..., func, value]; argument encodes attribute id (annotations/cellvars/etc).
    const value = this.dataStack.pop();
    const func = this.dataStack.pop();

    // If annotations tuple is paired with a function, attach them to the function.
    const attachAnnotations = (targetFunc, tupleNode) => {
        const annotations = {};
        const pairs = tupleNode?.values || [];
        for (let i = 0; i + 1 < pairs.length; i += 2) {
            const keyNode = pairs[i];
            const valNode = pairs[i + 1];
            let keyStr = keyNode?.object?.Value || keyNode?.name || keyNode?.codeFragment?.()?.toString?.() || keyNode?.toString?.() || '';
            if (typeof keyStr === 'string') {
                keyStr = keyStr.replace(/^['"]|['"]$/g, "");
            }
            if (keyStr) {
                annotations[keyStr] = valNode;
            }
        }
        targetFunc.annotations = annotations;
    };

    if (func instanceof AST.ASTFunction && value instanceof AST.ASTTuple) {
        attachAnnotations(func, value);
        this.dataStack.push(func);
    } else if (value instanceof AST.ASTFunction && func instanceof AST.ASTTuple) {
        attachAnnotations(value, func);
        this.dataStack.push(value);
    } else if (func instanceof AST.ASTFunction) {
        this.dataStack.push(func);
    } else if (value) {
        this.dataStack.push(value);
    }

    if (global.g_cliArgs?.debug) {
        console.log(`[SET_FUNCTION_ATTRIBUTE] arg=${this.code.Current.Argument}, func=${func?.constructor?.name}, value=${value?.constructor?.name}`);
    }
}

function processMakeFunction() {
    let func_code = this.dataStack.pop();

    if (!func_code) {
        if (global.g_cliArgs?.debug) {
            console.error(`[MAKE_FUNCTION] Stack underflow at offset ${this.code.Current.Offset}`);
        }
        return;
    }

    /* Test for the qualified name of the function (at TOS) */
    let tos_type = func_code.object?.ClassName;
    if (!["Py_CodeObject", "Py_CodeObject2"].includes(tos_type)) {
        func_code = this.dataStack.pop() || func_code; // Try one more slot
    }

    if (!func_code || !func_code.object || !["Py_CodeObject", "Py_CodeObject2"].includes(func_code.object.ClassName)) {
        // Try to salvage a code object from constants (3.13 specialized bytecode may reorder stack)
        const fallback = (this.object?.Consts?.Value || []).find(c => ["Py_CodeObject","Py_CodeObject2"].includes(c?.ClassName));
        if (fallback) {
            func_code = new (require('../ast/ast_node').ASTObject)(fallback);
        } else {
            // Give up gracefully: emit stub function
            let fnName = this.code.Current?.Name || `__function_${this.code.Current.Offset}__`;
            let stub = new (require('../ast/ast_node').ASTFunction)(fnName, new (require('../ast/ast_node').ASTBlock)());
            stub.line = this.code.Current.LineNo;
            this.dataStack.push(stub);
            return;
        }
    }

    let decompiler = new PycDecompiler(func_code.object);
    func_code.object.SourceCode = decompiler.decompile();
    if (decompiler.errors.length) this.errors.push(...decompiler.errors);

    let defArgs = [], kwDefArgs = [], annotationMap = null;

    const stringifyKey = (keyNode) => {
        let keyStr = keyNode?.object?.Value ?? keyNode?.name ?? keyNode?.codeFragment?.()?.toString?.() ?? keyNode?.toString?.() ?? '';
        if (typeof keyStr === 'string') {
            keyStr = keyStr.replace(/^['"]|['"]$/g, "");
        }
        return keyStr;
    };

    const buildAnnotationMap = (node) => {
        const map = {};
        // ASTObject wrapping a Py_Tuple constant — unpack
        if (node instanceof AST.ASTObject &&
            (node.object?.ClassName === 'Py_Tuple' || node.object?.ClassName === 'Py_SmallTuple')) {
            const items = (node.object.Value || []).map(v => new AST.ASTObject(v));
            for (let i = 0; i + 1 < items.length; i += 2) {
                const keyStr = stringifyKey(items[i]);
                if (keyStr) map[keyStr] = items[i + 1];
            }
            return map;
        }
        if (node instanceof AST.ASTTuple) {
            // Python 3.10+ format: (key1, val1, key2, val2, ...)
            const pairs = node.values || [];
            for (let i = 0; i + 1 < pairs.length; i += 2) {
                const keyStr = stringifyKey(pairs[i]);
                if (keyStr) map[keyStr] = pairs[i + 1];
            }
        } else if (node instanceof AST.ASTConstMap) {
            // Python 3.6–3.9 (BUILD_CONST_KEY_MAP): keys = ASTObject(tuple of names),
            // values = array popped from stack in reverse order.
            const keysObj = node.keys;
            let flatKeys = [];
            if (keysObj instanceof AST.ASTObject) {
                flatKeys = keysObj.object?.Value || [];
            } else if (Array.isArray(keysObj)) {
                flatKeys = keysObj;
            }
            const valuesArr = Array.isArray(node.values) ? [...node.values].reverse() : [];
            for (let i = 0; i < Math.min(flatKeys.length, valuesArr.length); i++) {
                let keyStr = flatKeys[i];
                if (keyStr && typeof keyStr === 'object') keyStr = keyStr.Value ?? keyStr.toString?.();
                if (typeof keyStr === 'string') keyStr = keyStr.replace(/^['"]|['"]$/g, "");
                if (keyStr) map[String(keyStr)] = valuesArr[i];
            }
        } else if (node instanceof AST.ASTMap) {
            // BUILD_MAP form: keys/values added in pairs.
            const keys = node.keys || [];
            const values = node.values || [];
            for (let i = 0; i < Math.min(keys.length, values.length); i++) {
                const keyStr = stringifyKey(keys[i]);
                if (keyStr) map[keyStr] = values[i];
            }
        }
        return map;
    };

    if (this.object.Reader.versionCompare(3, 6) >= 0) {
        // Python 3.6+ MAKE_FUNCTION uses flag-based encoding.
        // Stack from top → bottom: [closure(0x08)?, annotations(0x04)?, kwdefaults(0x02)?, defaults(0x01)?]
        const flags = this.code.Current.Argument;
        if (flags & 0x08) {
            this.dataStack.pop(); // closure tuple, captured via cellvars
        }
        if (flags & 0x04) {
            const annNode = this.dataStack.pop();
            annotationMap = buildAnnotationMap(annNode);
        }
        if (flags & 0x02) {
            const kwDict = this.dataStack.pop();
            if (kwDict instanceof AST.ASTConstMap || kwDict instanceof AST.ASTMap) {
                const keys = kwDict.keys || kwDict.m_keys || [];
                const values = kwDict.values || kwDict.m_values || [];
                for (let i = 0; i < Math.min(keys.length, values.length); i++) {
                    kwDefArgs.push({name: keys[i], value: values[i]});
                }
            }
        }
        if (flags & 0x01) {
            const defaults = this.dataStack.pop();
            if (defaults instanceof AST.ASTTuple) {
                defArgs = defaults.values;
            } else if (defaults instanceof AST.ASTObject &&
                       (defaults.object?.ClassName === 'Py_Tuple' || defaults.object?.ClassName === 'Py_SmallTuple')) {
                defArgs = (defaults.object.Value || []).map(v => new AST.ASTObject(v));
            }
        }
    } else if (this.object.Reader.versionCompare(3, 0) >= 0) {
        // Python 3.0–3.5 MAKE_FUNCTION/MAKE_CLOSURE uses count-based encoding.
        // arg = (numAnnotations << 16) | (kwDefCount << 8) | defCount
        // CPython push order (compile.c → ceval.c stack from bottom up):
        //   [kwdefault_name1, kwdefault_value1, ..., positional_default1, ...,
        //    annotation_value1, ..., annotation_names_tuple,
        //    closure_tuple (MAKE_CLOSURE only), code, qualname]
        // After qualname & code are already popped at top of processMakeFunction,
        // remaining stack top → bottom:
        //   [closure_tuple?, annotation_names_tuple?, annotation_values...,
        //    positional_defaults..., kwdefault pairs (name,value)...]
        // Pop order: closure → annotations → positional defaults → kwdefaults.
        let defCount = this.code.Current.Argument & 0xFF;
        let kwDefCount = (this.code.Current.Argument >> 8) & 0xFF;
        let numAnnotations = (this.code.Current.Argument >> 16) & 0x7FFF;

        if (this.code.Current.OpCodeID === this.OpCodes.MAKE_CLOSURE_A) {
            this.dataStack.pop(); // closure tuple — captured via cellvars elsewhere
        }

        if (numAnnotations > 0) {
            const namesTuple = this.dataStack.pop();
            // Names tuple is loaded via LOAD_CONST → ASTObject wrapping Py_Tuple,
            // OR (rare) BUILD_TUPLE → ASTTuple.
            let rawNames = [];
            if (namesTuple instanceof AST.ASTObject &&
                (namesTuple.object?.ClassName === 'Py_Tuple' || namesTuple.object?.ClassName === 'Py_SmallTuple')) {
                rawNames = namesTuple.object.Value || [];
            } else if (namesTuple instanceof AST.ASTTuple) {
                rawNames = namesTuple.values || [];
            } else if (namesTuple?.object?.Value) {
                rawNames = namesTuple.object.Value;
            }
            const names = rawNames.map(n => {
                let s = n?.Value ?? n?.object?.Value ?? n?.name ?? n?.toString?.() ?? '';
                if (typeof s === 'string') s = s.replace(/^['"]|['"]$/g, "");
                return s;
            });
            const valueCount = numAnnotations - 1;
            const values = [];
            for (let i = 0; i < valueCount; i++) {
                values.unshift(this.dataStack.pop());
            }
            annotationMap = {};
            for (let i = 0; i < Math.min(names.length, values.length); i++) {
                if (names[i]) annotationMap[names[i]] = values[i];
            }
        }
        // Positional defaults are popped BEFORE kwdefaults (they were pushed later).
        for (let idx = 0; idx < defCount; idx++) {
            defArgs.unshift(this.dataStack.pop());
        }
        for (let idx = 0; idx < kwDefCount; idx++) {
            const value = this.dataStack.pop();
            const name = this.dataStack.pop();
            kwDefArgs.unshift({name, value});
        }
    } else {
        // Python 2.x MAKE_FUNCTION: argument is just defCount.
        const defCount = this.code.Current.Argument & 0xFF;
        for (let idx = 0; idx < defCount; idx++) {
            defArgs.unshift(this.dataStack.pop());
        }
    }

    let node = new AST.ASTFunction(func_code, defArgs, kwDefArgs);
    if (annotationMap) {
        node.annotations = annotationMap;
    }
    this.dataStack.push(node);
}

function handleBuildTupleA() {
    if (this.dataStack.top() instanceof AST.ASTLoadBuildClass) {
        return;
    }

    let values = [];
    for (let idx = this.code.Current.Argument - 1; idx >= 0; idx--) {
        values[idx] = this.dataStack.pop();
    }

    let tupleNode = new AST.ASTTuple(values);
    tupleNode.line = this.code.Current.LineNo;
    this.dataStack.push(tupleNode);
}

function handleBuildMapA() {
    if (this.object.Reader.versionCompare(3, 5) >= 0) {
        // Collect key-value pairs from stack first
        let pairs = [];
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            let value = this.dataStack.pop();
            let key = this.dataStack.pop();
            pairs.push({key, value});
        }

        // Create map and add pairs in correct order (reverse because we popped)
        let mapNode = new AST.ASTMap();
        mapNode.line = this.code.Current.LineNo;
        for (let i = pairs.length - 1; i >= 0; i--) {
            mapNode.add(pairs[i].key, pairs[i].value);
        }

        this.dataStack.push(mapNode);
    } else {
        if (this.dataStack.top() instanceof AST.ASTChainStore) {
            this.dataStack.pop();
        }

        let mapNode = new AST.ASTMap();
        mapNode.line = this.code.Current.LineNo;
        this.dataStack.push(mapNode);
    }
}

function handleBuildConstKeyMapA() {
    let values = [];
    let keys = this.dataStack.pop();
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        values.push(this.dataStack.pop());
    }

    let mapNode = new AST.ASTConstMap(keys, values);
    mapNode.line = this.code.Current.LineNo;
    this.dataStack.push(mapNode);
}

function handleBuildStringA() {
    let values = [];
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        values.push(this.dataStack.pop());
    }

    let stringNode = new AST.ASTJoinedStr(values);
    stringNode.line = this.code.Current.LineNo;
    this.dataStack.push(stringNode);
}

function handleListToTuple() {
    let listNode = this.dataStack.pop();
    if (listNode instanceof AST.ASTList) {
        this.dataStack.push(new AST.ASTTuple(listNode.values));
    } else {
        console.error("Expected ASTList for LIST_TO_TUPLE");
    }
}

function handleLoadClosureA() {
    this.dataStack.push(new AST.ASTName(this.code.Current.FreeName));
}

function handleCopyFreeVarsA() {
    // Python 3.11+ COPY_FREE_VARS: copies free vars for class scopes; no AST impact.
}

module.exports = {
    handleBuildClass,
    handleBuildFunction,
    handleBuildListA,
    handleBuildSetA,
    handleBuildMapA,
    handleBuildConstKeyMapA,
    handleBuildStringA,
    handleBuildTupleA,
    handleLoadBuildClass,
    handleLoadClosureA,
    handleCopyFreeVarsA,
    handleMakeClosureA,
    handleMakeFunction,
    handleMakeFunctionA,
    handleMakeCellA,
    handleSetFunctionAttributeA,
    handleListToTuple
};
