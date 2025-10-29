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

function handleInstrumentedCallA() {
    let kwparams = (this.code.Current.Argument & 0xFF00) >> 8;
    let pparams = (this.code.Current.Argument & 0xFF);
    let kwparamList = [];
    let pparamList = [];
    let loadBuildClassFound = false;

    for (let idx = this.dataStack.length - 1; idx >= 0; idx--) {
        if (this.dataStack[idx] instanceof AST.ASTLoadBuildClass) {
            loadBuildClassFound = true;
            break;
        }
    }

    if (loadBuildClassFound) {
        let bases = [];
        let TOS = this.dataStack.top();

        while (TOS instanceof AST.ASTName || TOS instanceof AST.ASTBinary) {
            bases.push(TOS);
            this.dataStack.pop();
            TOS = this.dataStack.top();
        }

        // qualified name is PycString at TOS
        let name = this.dataStack.pop();
        let functionNode = this.dataStack.pop();
        let loadbuild = this.dataStack.pop();
        if (loadbuild instanceof AST.ASTLoadBuildClass) {
            let callNode = new AST.ASTCall(functionNode, pparamList, kwparamList);
            callNode.line = this.code.Current.LineNo;
            let classNode = new AST.ASTClass(callNode, new AST.ASTTuple(bases), name);
            classNode.line = this.code.Current.LineNo;
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
        } else {
            pparamList.unshift(param);
        }
    }

    if (skipCallNode) {
        return;
    }

    let func = this.dataStack.pop();
    if ([this.OpCodes.CALL_A, this.OpCodes.INSTRUMENTED_CALL_A].includes(this.code.Current.OpCodeID) && this.dataStack.length > 0 && this.dataStack.top() == null) {
        this.dataStack.pop();
    }

    if ([this.OpCodes.GET_ITER, this.OpCodes.GET_AITER].includes(this.code.Prev.OpCodeID)) {
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
                    }
                }
            }
        }
        this.dataStack.push(ast);

    } else {
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
    let flags = this.code.Current.Argument;
    let kwparams = [];
    let pparams = [];
    if (flags & 0x01) { // **kwargs
        let kw = this.dataStack.pop();
        if (kw instanceof AST.ASTMap) {
            kwparams = kw.values;
        } else {
            console.error("Expected a map for CALL_FUNCTION_EX kwargs");
        }
    }
    if (flags & 0x02) { // *args
        let args = this.dataStack.pop();
        if (args instanceof AST.ASTTuple || args instanceof AST.ASTList) {
            pparams = args.values;
        } else {
            console.error("Expected a tuple or list for CALL_FUNCTION_EX args");
        }
    }
    let func = this.dataStack.pop();
    let callNode = new AST.ASTCall(func, pparams, kwparams);
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleCallIntrinsic1() {
    // Python 3.12+ CALL_INTRINSIC_1 opcode
    // Calls built-in intrinsic functions (argument specifies which)
    // Intrinsic 3: ASYNC_GEN_WRAP (wraps async generator function)
    // Intrinsic 4: STOPITERATION_ERROR, etc.

    // Intrinsic takes 1 arg from stack, returns result
    // For decompilation: preserve the argument as result

    let arg = this.dataStack.pop();

    if (global.g_cliArgs?.debug) {
        console.log(`[CALL_INTRINSIC_1] intrinsic=${this.code.Current.Argument}, arg=${arg?.constructor?.name}`);
    }

    // For async generators, arg is the function object - keep it unchanged
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

    // No-op for decompilation
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
    handleCallIntrinsic2A
};