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
    const varNames = this.object?.VarNames?.Value || [];
    const name = varNames[this.code.Current.Argument]?.toString?.() || `##cell_${this.code.Current.Argument}##`;
    this.dataStack.push(new AST.ASTName(name));
}

function handleSetFunctionAttributeA() {
    // Stack: [..., func, value]; argument encodes attribute id (annotations/cellvars/etc).
    const value = this.dataStack.pop();
    const func = this.dataStack.pop();

    // If annotations tuple is underneath the function, discard tuple and keep function.
    if (value instanceof AST.ASTFunction && func instanceof AST.ASTTuple) {
        const annotations = {};
        const pairs = func.values || [];
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
        value.annotations = annotations;
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

    let annotationMap = null;
    // Python 3.11+ MAKE_FUNCTION flag bit 0x4 indicates annotations tuple on stack before code object
    if ((this.object.Reader.versionCompare(3, 11) >= 0) &&
        (this.code.Current.Argument & 0x04) &&
        this.dataStack.top() instanceof AST.ASTTuple) {
        const tupleAnn = this.dataStack.pop();
        const pairs = tupleAnn.values || [];
        annotationMap = {};
        for (let i = 0; i + 1 < pairs.length; i += 2) {
            const keyNode = pairs[i];
            const valNode = pairs[i + 1];
            let keyStr = keyNode?.object?.Value || keyNode?.name || keyNode?.codeFragment?.()?.toString?.() || keyNode?.toString?.() || '';
            if (typeof keyStr === 'string') {
                keyStr = keyStr.replace(/^['"]|['"]$/g, "");
            }
            if (keyStr) {
                annotationMap[keyStr] = valNode;
            }
        }
    }

    let defArgs = [], kwDefArgs = [], annotations = [];
    const is311Plus = this.object.Reader.versionCompare(3, 11) >= 0;
    if (is311Plus) {
        const flags = this.code.Current.Argument;
        // defaults tuple
        if (flags & 0x01) {
            const defaults = this.dataStack.pop();
            if (defaults instanceof AST.ASTTuple) {
                defArgs = defaults.values;
            }
        }
        // kwdefaults mapping (rare in these fixtures)
        if (flags & 0x02) {
            this.dataStack.pop(); // discard kwdefaults for now
        }
        // annotations handled earlier (0x04)
        if (flags & 0x08) {
            this.dataStack.pop(); // closure tuple
        }
    } else {
        let defCount = this.code.Current.Argument & 0xFF;
        let kwDefCount = (this.code.Current.Argument >> 8) & 0xFF;
        let numAnnotations = (this.code.Current.Argument >> 16) & 0xFF;
        
        if (this.object.Reader.versionCompare(3, 0) < 0) {
            for (let idx = 0; idx < defCount; ++idx) {
                defArgs.unshift(this.dataStack.pop());
            }
            
            if (kwDefCount > 0) {
                for (let idx = 0; idx < kwDefCount - defCount; ++idx) {
                    kwDefArgs.unshift(this.dataStack.pop());
                }
            }
        } else {
            if (numAnnotations > 0) {
                let tuple = this.dataStack.pop();
                while (--numAnnotations > 0) {
                    annotations.push({key: tuple[numAnnotations], value: this.dataStack.pop()})
                }
            }

            if (defCount > 0) {
                while (defCount-- > 0) {
                    defArgs.unshift(this.dataStack.pop());
                }
            }

            if (kwDefCount > 0) {
                while (kwDefCount-- > 0) {
                    let value = this.dataStack.pop();
                    let name = this.dataStack.pop();
                    kwDefArgs.unshift({name, value});
                }
            }
        }
    }

    let node = new AST.ASTFunction (func_code, defArgs, kwDefArgs, annotations);
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
