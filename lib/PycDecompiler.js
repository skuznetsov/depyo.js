const PycResult = require('./PycResult');
const PycObject = require('./PythonObject').PythonObject;
const AST = require('./ast/ast_node');

let OpCodes = null;

Array.prototype.top = function ArrayTop (pos = 0) {
    return this[this.length - pos - 1];
}

Array.prototype.empty = function ArrayIsEmpty () {
    return this.length == 0;
}

class PycDecompiler {
    static cleanBuild = false;
    object = null;
    code = null;
    blocks = [];
    unpack = 0;
    starPos = -1;
    skipNextJump = false;
    else_pop = false;
    variable_annotations = null;
    need_try = null;
    defBlock = null;
    curBlock = null;
    dataStack = [];
    handlers = {};

    constructor(obj) {
        if (obj == null) {
            return;
        }

        this.object = obj;
        this.OpCodes = this.object.Reader.OpCodes;
        this.code = new this.OpCodes(this.object);
        this.defBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Main, 0, this.code.LastOffset);
        this.defBlock.init();
        this.curBlock = this.defBlock;
        this.blocks.push(this.defBlock);
        this.setupHandlers();
    }

    setupHandlers() {
        for (let handler of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            if (handler.startsWith("handle")) {
                let opCode = handler.replace(/^handle/, '')
                                    .replaceAll(/([A-Z][a-z]+)/g, m => {
                                        return m.toUpperCase() + '_';
                                    })
                                    .replace(/_$/, '');
                if (opCode in this.OpCodes) {
                    this.handlers[this.OpCodes[opCode]] = this[handler].bind(this);
                }
            }
        }

    }

    decompile() {
        let functonBody = this.statements();

        if (this.object.Name != "<lambda>" && functonBody.last instanceof AST.ASTReturn && functonBody.last.value instanceof AST.ASTNone) {
            functonBody.list.pop();
        }

        if (functonBody.list.length == 0) {
            functonBody.list.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
        }


        return functonBody;
    }

    append_to_chain_store(chainStore, item)
    {
        if (this.dataStack.top() == item) {
            this.dataStack.pop();    // ignore identical source object.
        }
        chainStore.append(item);
        if (this.dataStack.top()?.ClassName == "Py_Null") {
            this.curBlock.append(chainStore);
        } else {
            this.dataStack.push(chainStore);
        }
    }

    checkIfExpr()
    {
        if (this.dataStack.empty())
            return;
        if (this.curBlock.nodes.length < 2)
            return;
        let rit = this.curBlock.nodes[this.curBlock.nodes.length - 1];
        // the last is "else" block, the one before should be "if" (could be "for", ...)
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.Else)
            return;
        rit = this.curBlock.nodes[this.curBlock.nodes.length - 2];
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.If)
            return;
        let else_expr = this.dataStack.pop();
        this.curBlock.removeLast();
        let if_block = this.curBlock.nodes.top();
        let if_expr = this.dataStack.pop();
        if (if_expr == null && if_block.nodes.length == 1) {
            if_expr = if_block.nodes[0];
            if_block.nodes.length = 0;
        }
        this.curBlock.removeLast();
        this.dataStack.push(new AST.ASTTernary(if_block, if_expr, else_expr));
    }
    
    statements () {
        if (this.object == null) {
            return null;
        }
    
        while (this.code.HasInstructionsToProcess) {                
            try {                
                this.code.GoNext();

                if (this.need_try && this.code.Current.OpCodeID != this.OpCodes.SETUP_EXCEPT_A) {
                    this.need_try = false;
        
                    let tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, this.code.Current.Offset, this.curBlock.end, true);
                    this.blocks.push(tryBlock);
                    this.curBlock = this.blocks.top();
                } else if (
                    this.else_pop &&
                    ![
                        this.OpCodes.JUMP_FORWARD_A,
                        this.OpCodes.JUMP_IF_FALSE_A,
                        this.OpCodes.JUMP_IF_FALSE_OR_POP_A,
                        this.OpCodes.POP_JUMP_IF_FALSE_A,
                        this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
                        this.OpCodes.JUMP_IF_TRUE_A,
                        this.OpCodes.JUMP_IF_TRUE_OR_POP_A,
                        this.OpCodes.POP_JUMP_IF_TRUE_A,
                        this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
                        this.OpCodes.POP_BLOCK
                    ].includes(this.code.Current.OpCodeID)
                ) {
                    this.else_pop = false;
        
                    let prev = this.curBlock;
                    while (prev.end < this.code.Next?.Offset && prev.blockType != AST.ASTBlock.BlockType.Main) {
                        if (prev.blockType != AST.ASTBlock.BlockType.Container) {
                            if (prev.end == 0) {
                                break;
                            }
                        }
                        this.blocks.pop();
        
                        if (this.blocks.empty())
                            break;
        
                        this.curBlock = this.blocks.top();
                        this.curBlock.append(prev);
        
                        prev = this.curBlock;
        
                        this.checkIfExpr();
                    }
                }
        
                if (this.code.Current.OpCodeID in this.handlers)
                {
                    this.handlers[this.code.Current.OpCodeID]();
                } else {
                    console.error(`Unsupported opcode ${this.code.Current.InstructionName} at pos ${this.code.Current.Offset}\n`);
                    this.cleanBuild = false;
                    let node = new AST.ASTNodeList(this.defBlock.nodes);
                    return node;
                }
                this.else_pop = [AST.ASTBlock.BlockType.Else,
                            AST.ASTBlock.BlockType.If,
                            AST.ASTBlock.BlockType.Elif
                            ].includes(this.curBlock.blockType)
                        && (this.curBlock.end == this.code.Next?.Offset);

            } catch (ex) {
                console.error(`EXCEPTION for OpCode ${this.code.Current.InstructionName} (${this.code.Current.Argument}) at offset ${this.code.Current.Offset} in code object '${this.object.Name}' : ${ex.message}\n\n`);
            }
        }
    
        if (this.blocks.length > 1) {
            console.error(`Warning: block stack is not empty\n${g_cliArgs.debug ? JSON.stringify(this.blocks.slice(1),(key, value) => {
                return key == 'm_obj' ? null : value;
            },2) : ''}\n`);
    
            while (this.blocks.length > 1) {
                let tmp = this.blocks.pop();
                this.blocks.top().append(tmp);
            }
        }
    
        this.cleanBuild = true;
        let mainNode = new AST.ASTNodeList(this.defBlock.nodes);
        return mainNode;
    }

    handleBinaryOpA()
    {
        let rVal = this.dataStack.pop();
        let lVal = this.dataStack.pop();
        let op = AST.ASTBinary.from_binary_op(this.code.Current.Argument);
        if (op == AST.ASTBinary.BinOp.InvalidOp) {
            // TODO: Throw and handle proper exeception.
            throw new SyntaxError("Invalid op");
        }
        let node = new AST.ASTBinary(lVal, rVal,op);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleBinaryAdd() {
        this.processBinaryOp();
    }

    handleBinaryAnd() {
        this.processBinaryOp();
    }

    handleBinaryDivide(){
        this.processBinaryOp();
    }

    handleBinaryFloorDivide() {
        this.processBinaryOp();
    }

    handleBinaryLshift(){
        this.processBinaryOp();
    }

    handleBinaryModulo() {
        this.processBinaryOp();
    }

    handleBinaryMultiply() {
        this.processBinaryOp();
    }

    handleBinaryOr() {
        this.processBinaryOp();
    }

    handleBinaryPower() {
        this.processBinaryOp();
    }

    handleBinaryRshift() {
        this.processBinaryOp();
    }

    handleBinarySubtract() {
        this.processBinaryOp();
    }

    handleBinaryTrueDivide() {
        this.processBinaryOp();
    }

    handleBinaryXor() {
        this.processBinaryOp();
    }

    handleBinaryMatrixMultiply() {
        this.processBinaryOp();
    }

    handleInplaceAdd() {
        this.processBinaryOp();
    }

    handleInplaceAnd() {
        this.processBinaryOp();
    }

    handleInplaceDivide() {
        this.processBinaryOp();
    }

    handleInplaceFloorDivide() {
        this.processBinaryOp();
    }

    handleInplaceLShift() {
        this.processBinaryOp();
    }

    handleInplaceModulo() {
        this.processBinaryOp();
    }

    handleInplaceMultiply() {
        this.processBinaryOp();
    }

    handleInplaceOr() {
        this.processBinaryOp();
    }

    handleInplacePower() {
        this.processBinaryOp();
    }

    handleInplaceRshift() {
        this.processBinaryOp();
    }

    handleInplaceSubtract() {
        this.processBinaryOp();
    }

    handleInplaceTrueDivide() {
        this.processBinaryOp();
    }

    handleInplaceXor() {
        this.processBinaryOp();
    }

    handleInplaceMatrixMultiply() {
        this.processBinaryOp();
    }

    processBinaryOp()
    {
        let rVal = this.dataStack.pop();
        let lVal = this.dataStack.pop();
        let op = AST.ASTBinary.from_opcode(this.code.Current.OpCodeID);
        if (op == AST.ASTBinary.BinOp.InvalidOp) {
            // TODO: Throw and handle proper exeception.
            throw new SyntaxError("Invalid op");
        }
        let node = new AST.ASTBinary(lVal, rVal,op);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleBinarySubscr()
    {
        let subscr = this.dataStack.pop();
        let src = this.dataStack.pop();
        let node = new AST.ASTSubscr(src, subscr);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleBreakLoop() {
        let keywordNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Break);
        keywordNode.line = this.code.Current.LineNo;
        this.curBlock.append(keywordNode);
    }

    handleBuildClass() {
        let classCode = this.dataStack.pop();
        let bases = this.dataStack.pop();
        let name = this.dataStack.pop();
        let classNode = new AST.ASTClass(classCode, bases, name);
        this.dataStack.push(classNode);
    }

    handleBuildFunction() {
        let functionCode = this.dataStack.pop();
        let functionNode = new AST.ASTFunction(functionCode);
        this.dataStack.push(functionNode);
    }

    handleBuildListA() {
        let values = [];

        for (let idx = this.code.Current.Argument - 1; idx >= 0; idx--) {
            values[idx] = this.dataStack.pop();
        }

        let listNode = new AST.ASTList(values);
        this.dataStack.push(listNode);
    }

    handleBuildSetA() {
        let values = [];

        for (let idx = this.code.Current.Argument - 1; idx >= 0; idx--) {
            values[idx] = this.dataStack.pop();
        }

        let listNode = new AST.ASTSet(values);
        this.dataStack.push(listNode);
        if (this.code.Next.OpCodeID == this.OpCodes.DUP_TOP) {
            this.code.GoNext();
        }
    }

    handleSetAdd() {
        this.handleSetAddA();
    }

    handleSetAddA() {
        let setOffset = this.code.Current.OpCodeID == this.OpCodes.SET_ADD_A ? this.code.Current.Argument - 1 : 0;
        let setNode = this.dataStack.top(setOffset);
        let value = this.dataStack.pop();
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.For && this.curBlock.comprehension) {
            this.dataStack.pop();
            let node = new AST.ASTComprehension (value);
            node.line = this.code.Current.LineNo;
            node.kind = AST.ASTComprehension.SET;
            this.dataStack.push(node);
        } else {
            setNode.add(value);
        }
    }

    handleBuildMapA() {
        if (this.object.Reader.versionCompare(3, 5) >= 0) {
            let mapNode = new AST.ASTMap();
            mapNode.line = this.code.Current.LineNo;
            this.dataStack.push(mapNode);

            for (let idx = 0; idx < this.code.Current.Argument; idx++) {
                let value = this.dataStack.pop();
                let key = this.dataStack.pop();
                mapNode.add(key, value);
            }
        } else {
            if (this.dataStack.top() instanceof AST.ASTChainStore) {
                this.dataStack.pop();
            }

            let mapNode = new AST.ASTMap();
            mapNode.line = this.code.Current.LineNo;
            this.dataStack.push(mapNode);
        }
    }

    handleBuildConstKeyMapA() {
        let values = [];
        let keys = this.dataStack.pop();
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            values.push(this.dataStack.pop());
        }

        let mapNode = new AST.ASTConstMap(keys, values);
        mapNode.line = this.code.Current.LineNo;
        this.dataStack.push(mapNode);
    }

    handleMapAddA() {
        this.handleBuildSliceA();
    }

    handleStoreMap() {
        this.handleBuildSliceA();
    }

    handleBuildSliceA() {
        if (this.code.Current.Argument == 2) {
            let end = this.dataStack.pop();
            let start = this.dataStack.pop();

            if (start instanceof AST.ASTObject && (start.object == null || start.object.ClassName == 'Py_None')) {
                start = null;
            }

            if (end instanceof AST.ASTObject && (end.object == null || end.object.ClassName == 'Py_None')) {
                end = null;
            }

            let sliceOp = null;
            if (!start && !end) {
                sliceOp = AST.ASTSlice.SliceOp.Slice0;
            } else if (!start) {
                sliceOp = AST.ASTSlice.SliceOp.Slice2;
            } else if (!end) {
                sliceOp = AST.ASTSlice.SliceOp.Slice1;
            } else {
                sliceOp = AST.ASTSlice.SliceOp.Slice3;
            }

            let mapNode = new AST.ASTSlice(sliceOp, start || new AST.ASTNone(), end || new AST.ASTNone());
            mapNode.line = this.code.Current.LineNo;
            this.dataStack.push(mapNode);
        } else if (this.code.Current.Argument == 3) {
            let step = this.dataStack.pop();
            let end = this.dataStack.pop();
            let start = this.dataStack.pop();

            if (start instanceof AST.ASTObject && (start.object == null || start.object.ClassName == 'Py_None')) {
                start = null;
            }

            if (end instanceof AST.ASTObject && (end.object == null || end.object.ClassName == 'Py_None')) {
                end = null;
            }

            if (step instanceof AST.ASTObject && (step.object == null || step.object.ClassName == 'Py_None')) {
                step = null;
            }

            let sliceOp = null;
            if (!start && !end) {
                sliceOp = AST.ASTSlice.SliceOp.Slice0;
            } else if (!start) {
                sliceOp = AST.ASTSlice.SliceOp.Slice2;
            } else if (!end) {
                sliceOp = AST.ASTSlice.SliceOp.Slice1;
            } else {
                sliceOp = AST.ASTSlice.SliceOp.Slice3;
            }

            let lhs = new AST.ASTSlice(sliceOp, start || new AST.ASTNone(), end || new AST.ASTNone());
            lhs.line = this.code.Current.LineNo;

            if (!step) {
                sliceOp = AST.ASTSlice.SliceOp.Slice1;
            } else {
                sliceOp = AST.ASTSlice.SliceOp.Slice3;
            }

            let sliceNode = new AST.ASTSlice(sliceOp, start || new AST.ASTNone(), end || new AST.ASTNone());
            sliceNode.line = this.code.Current.LineNo;
            this.dataStack.push(sliceNode);
        }
    }

    handleBuildStringA() {
        let values = [];
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            values.push(this.dataStack.pop());
        }

        let stringNode = new AST.ASTJoinedStr(values);
        stringNode.line = this.code.Current.LineNo;
        this.dataStack.push(stringNode);
    }

    handleBuildTupleA() {
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

    handleKwNamesA() {
        let astNode = new AST.ASTKwNamesMap();
        let keys = this.code.Current.ConstantObject;
        for (let idx = keys.length - 1; idx >= 0; idx--) {
            astNode.add(keys[idx], this.dataStack.pop());
        }

        astNode.line = this.code.Current.LineNo;
        this.dataStack.push(astNode);
    }

    handleCallA() {
        this.handleInstrumentedCallA();
    }

    handleCallFunctionA() {
        this.handleInstrumentedCallA();
    }

    handleInstrumentedCallA() {
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
                let classNode = new AST.ASTClass(call, new AST.ASTTuple(bases), name);
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

    handleCallFunctionVarA() {
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

    handleCallFunctionKwA() {
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

    handleCallFunctionVarKwA() {
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

    handleCallMethodA() {
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

    handleContinueLoopA() {
        let node = new AST.ASTKeyword (AST.ASTKeyword.Word.Continue);
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleCompareOpA() {
        let right = this.dataStack.pop();
        let left = this.dataStack.pop();
        let arg = this.code.Current.Argument;
        if (this.object.Reader.versionCompare(3, 12) >= 0) {
            arg >>= 4;
        }
        let node = new AST.ASTCompare (left, right, arg);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleContainsOpA() {
        let right = this.dataStack.pop();
        let left = this.dataStack.pop();
        // The this.code.Current.Argument will be 0 for 'in' and 1 for 'not in'.
        let node = new AST.ASTCompare (left, right, this.code.Current.Argument ? AST.ASTCompare.CompareOp.NotIn : AST.ASTCompare.CompareOp.In);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleDeleteAttrA() {
        let name = this.dataStack.pop();
        let node = new AST.ASTDelete(new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr));
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDeleteGlobalA() {
        this.object.Globals.add(this.code.Current.Name);
        this.handleDeleteNameA();
    }

    handleDeleteNameA() {
        let varname = this.code.Current.Name;

        if (varname.length >= 2 && varname.startsWith('_[')) {
            /* Don't show deletes that are a result of list comps. */
            return;
        }

        let node = new AST.ASTDelete(new AST.ASTName(varname));
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDeleteFastA() {
        let nameNode = new AST.ASTName(this.code.Current.Name);

        if (nameNode.name.startsWith('_[')) {
            /* Don't show deletes that are a result of list comps. */
            return;
        }

        let node = new AST.ASTDelete(nameNode);
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDeleteSlice0() {
        let name = this.dataStack.pop();
        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice0)));
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDeleteSlice1() {
        let upper = this.dataStack.pop();
        let name = this.dataStack.pop();

        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, upper)));
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDeleteSlice2() {
        let lower = this.dataStack.pop();
        let name = this.dataStack.pop();

        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, lower)));
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDeleteSlice3() {
        let lower = this.dataStack.pop();
        let upper = this.dataStack.pop();
        let name = this.dataStack.pop();

        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, upper, lower)));
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDeleteSubscr() {
        let key = this.dataStack.pop();
        let name = this.dataStack.pop();

        let node = new AST.ASTDelete(new AST.ASTSubscr(name, key));
        node.line = this.code.Current.LineNo;
        this.curBlock.nodes.push(node);
    }

    handleDupTop() {
        if (this.dataStack.top() == null) {
            this.dataStack.push(null);
        } else if (this.code.Next?.OpCodeID == this.OpCodes.ROT_THREE) {
            // double compare case
            this.skipNextJump = true;
            this.code.GoNext();
        } else if (this.dataStack.top() instanceof AST.ASTChainStore) {
            let chainstore = this.dataStack.pop();
            this.dataStack.push(this.dataStack.top());
            this.dataStack.push(chainstore);
        } else {
            this.dataStack.push(this.dataStack.top());
            let node = new AST.ASTChainStore ([], this.dataStack.top());
            this.dataStack.push(node);
        }
    }

    handleDupTopTwo() {
        let first = this.dataStack.pop();
        let second = this.dataStack.top();

        this.dataStack.push(first);
        this.dataStack.push(second);
        this.dataStack.push(first);
    }

    handleDupTopxA() {
        let first = [];
        let second = [];

        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            let node = this.dataStack.pop();
            first.push(node);
            second.push(node);
        }

        while (first.length) {
            this.dataStack.push(first.pop());
        }

        while (second.length) {
            this.dataStack.push(second.pop());
        }
    }

    handleEndFinally() {
        let isFinally = false;
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Finally) {
            let final = this.curBlock;
            this.blocks.pop();

            this.curBlock = this.blocks.top();
            this.curBlock.nodes.push(final);
            isFinally = true;
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
            this.blocks.pop();
            let prev = this.curBlock;

            let isUninitAsyncFor = false;
            if (this.blocks.top().blockType == AST.ASTBlock.BlockType.Container) {
                let container = this.blocks.pop();
                let asyncForBlock = this.blocks.top();
                isUninitAsyncFor = asyncForBlock.blockType == AST.ASTBlock.BlockType.AsyncFor && !asyncForBlock.inited;
                if (isUninitAsyncFor) {
                    let tryBlock = container.nodes[0];
                    if (!tryBlock.nodes.empty() && tryBlock.blockType == AST.ASTBlock.BlockType.Try) {
                        let store = tryBlock.nodes[0];
                        if (store) {
                            asyncForBlock.index = store.dest;
                        }
                    }
                    this.curBlock = this.blocks.top();

                    if (!this.curBlock.inited) {
                        console.error("Error when decompiling 'async for'.\n");
                    }
                } else {
                    this.blocks.push(container);
                }
            }

            if (!isUninitAsyncFor) {
                if (!this.curBlock.empty()) {
                    this.blocks.top().append(this.curBlock);
                }

                this.curBlock = this.blocks.top();

                /* Turn it into an else statement. */
                if (this.curBlock.end != this.code.Next?.Offset || this.curBlock.hasFinally) {
                    let elseblk = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, prev.end);
                    elseblk.init();
                    this.blocks.push(elseblk);
                    this.curBlock = this.blocks.top();
                }
            }
        }

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
            /* This marks the end of the except block(s). */
            let cont = this.curBlock;
            if (!cont.hasFinally || isFinally) {
                /* If there's no finally block, pop the container. */
                this.blocks.pop();
                this.curBlock = this.blocks.top();
                this.curBlock.append(cont);
            }
            if (cont. hasFinally) {

            }
        }
    }

    handleExecStmt() {
        if (this.dataStack.top() instanceof AST.ASTChainStore) {
            this.dataStack.pop();
        }
        let loc = this.dataStack.pop();
        let glob = this.dataStack.pop();
        let stmt = this.dataStack.pop();
        let node = new AST.ASTExec(stmt, glob, loc);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleForIterA() {
        this.handleInstrumentedForIterA();
    }
    
    handleInstrumentedForIterA() {
        let iter = this.dataStack.pop(); // Iterable
        /* Pop it? Don't pop it? */

        let start = this.code.Current.Offset;
        let end = 0;
        let line = this.code.Current.LineNo;
        let comprehension = false;

        // before 3.8, there is a SETUP_LOOP instruction with block start and end position,
        //    the this.code.Current.Argument is usually a jump to a POP_BLOCK instruction
        // after 3.8, block extent has to be inferred implicitly; the this.code.Current.Argument is a jump to a position after the for block
        if (this.object.Reader.versionCompare(3, 8) >= 0) {
            end = this.code.Current.Argument;
            if (this.object.Reader.versionCompare(3, 10) >= 0)
                end *= 2; // // BPO-27129
            end += this.code.Next?.Offset;
            [end] = this.code.FindEndOfBlock(end);
            comprehension = this.code.Current.Name == "<listcomp>";
        } else {
            if ((this.dataStack.top() instanceof AST.ASTSet ||
                this.dataStack.top() instanceof AST.ASTList ||
                this.dataStack.top() instanceof AST.ASTMap)
                && this.dataStack.top().values.length == 0) {
                end = this.code.Current.JumpTarget;
                comprehension = true;
            } else {
                let top = this.blocks.top();
                start = top.start;
                end = top.end; // block end position from SETUP_LOOP
                line = top.line;

                if (top.blockType == AST.ASTBlock.BlockType.While) {
                    this.blocks.pop();
                } else {
                    comprehension = true;
                }
            }
        }

        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.For, start, end, iter);
        forblk.line = line;
        forblk.comprehension = comprehension;
        this.blocks.push(forblk);
        this.curBlock = this.blocks.top();

        this.dataStack.push(null);
    }

    handleForLoopA() {
        let curidx = this.dataStack.pop(); // Current index
        let iter = this.dataStack.pop(); // Iterable

        let comprehension = false;
        let top = this.blocks.top();

        if (top.blockType == AST.ASTBlock.BlockType.While) {
            this.blocks.pop();
        } else {
            comprehension = true;
        }
        
        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.For, this.code.Current.Offset, top.end, iter);
        forblk.line = this.code.Current.LineNo;
        forblk.comprehension = comprehension;
        this.blocks.push(forblk);
        this.curBlock = this.blocks.top();

        /* Python Docs say:
                "push the sequence, the incremented counter,
                and the current item onto the this.dataStack." */
        this.dataStack.push(iter);
        this.dataStack.push(curidx);
        this.dataStack.push(null); // We can totally hack this >_>
    }

    handleGetAiter() {
        // Logic similar to FOR_ITER_A
        let iter = this.dataStack.pop(); // Iterable

        let top = this.blocks.top();
        if (top.blockType == AST.ASTBlock.BlockType.While) {
            this.blocks.pop();
            let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.AsyncFor, top.start, top.end, iter);
            forblk.line = this.code.Current.LineNo;
            this.blocks.push(forblk);
            this.curBlock = this.blocks.top();
            this.dataStack.push(null);
        } else {
                console.error("Unsupported use of GET_AITER outside of SETUP_LOOP\n");
        }
    }

    handleGetAnext() {
            let iter = this.dataStack.top();
            let callNode = new AST.ASTCall(new AST.ASTName('await'), [new AST.ASTBinary(iter, new AST.ASTName('__anext__'), AST.ASTBinary.BinOp.Attr)], []);
            callNode.line = this.code.Current.LineNo;
            this.dataStack.push(callNode);
        }

    handleBeforeAsyncWith() {
        let ctxmgr = this.dataStack.top();
        let callNode = new AST.ASTCall(new AST.ASTName('await'), [new AST.ASTBinary(ctxmgr, new AST.ASTName('__aenter__'), AST.ASTBinary.BinOp.Attr)], []);
        callNode.line = this.code.Current.LineNo;
        this.dataStack.push(callNode);
    }

    handleFormatValueA() {
        let conversion_flag = this.code.Current.Argument;
        switch (conversion_flag) {
            case AST.ASTFormattedValue.ConversionFlag.None:
            case AST.ASTFormattedValue.ConversionFlag.Str:
            case AST.ASTFormattedValue.ConversionFlag.Repr:
            case AST.ASTFormattedValue.ConversionFlag.ASCII:
            {
                let val = this.dataStack.pop();
                let node = new AST.ASTFormattedValue (val, conversion_flag, null);
                node.line = this.code.Current.LineNo;
                this.dataStack.push(node);
            }
            break;
            case AST.ASTFormattedValue.ConversionFlag.FmtSpec:
            {
                let format_spec = this.dataStack.pop();
                let val = this.dataStack.pop();
                let node = new AST.ASTFormattedValue (val, conversion_flag, format_spec);
                node.line = this.code.Current.LineNo;
                this.dataStack.push(node);
            }
            break;
            default:
                console.error(`Unsupported FORMAT_VALUE_A conversion flag: ${this.code.Current.Argument}\n`);
        }
    }

    handleGetAwaitable() {
        let object = this.dataStack.pop();
        let node = new AST.ASTAwaitable (object);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleGetIter() {
        this.handleGetYieldFromIter();
    }

    handleGetYieldFromIter() {
        /* We just entirely ignore this */
        if (this.code.Next.OpCodeID == this.OpCodes.CALL_FUNCTION_A) {
            this.dataStack.push(new AST.ASTIteratorValue(this.dataStack.pop()));
        }
    }

    handleImportNameA() {
        if (this.object.Reader.versionCompare(2, 0) < 0) {
            let node = new AST.ASTImport(new AST.ASTName(this.code.Current.Name), null);
            node.line = this.code.Current.LineNo;
            this.dataStack.push(node);
        } else {
            let fromlist = this.dataStack.pop();
            if (fromlist instanceof AST.ASTNone) {
                fromlist = null;
            }
            let dots = '';
            if (this.object.Reader.versionCompare(2, 5) >= 0) {
                let importLevelNode = this.dataStack.pop();    // Level
                let importLevel = +importLevelNode?.object || -1;
                if (importLevel > 0) {
                    dots = Buffer.alloc(importLevel, '.').toString('ascii');
                }
            }

            let node = new AST.ASTImport (new AST.ASTName(dots + this.code.Current.Name), fromlist);
            node.line = this.code.Current.LineNo;

            if (this.code.Next?.OpCodeID == this.OpCodes.IMPORT_STAR) {
                node.add_store(new AST.ASTStore(new AST.ASTName("*"), null));
                this.code.GoNext();
            } else if (fromlist?.object?.ClassName == 'Py_Tuple' && fromlist.object.Value.length > 0) {
                this.code.extractImportNames(fromlist.object, (name, alias) => {
                    node.add_store(new AST.ASTStore(new AST.ASTName(name), new AST.ASTName(alias)));
                });
            } else if (!fromlist) {
                let aliasNode = this.code.GetOpCodeByName("STORE_*");
                node.alias = new AST.ASTName(aliasNode.Label);
                this.code.GoToOffset(aliasNode.Offset);
            } else {
                console.error('WARNING: Not covered situation in IMPORT_NAME.');
            }

            this.curBlock.nodes.push(node);

        }
    }

    handleImportFromA() {}
    handleImportStar() {}
    handleIsOpA() {
        let right = this.dataStack.pop();
        let left = this.dataStack.pop();
        // The this.code.Current.Argument will be 0 for 'is' and 1 for 'is not'.
        let node = new AST.ASTCompare (left, right, this.code.Current.Argument ? AST.ASTCompare.CompareOp.IsNot : AST.ASTCompare.CompareOp.Is);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleJumpIfFalseA() {
        this.processJumpOps();
    }

    handleJumpIfTrueA() {
        this.processJumpOps();
    }

    handleJumpIfFalseOrPopA() {
        this.processJumpOps();
    }

    handleJumpIfTrueOrPopA() {
        this.processJumpOps();
    }

    handlePopJumpIfFalseA() {
        this.processJumpOps();
    }

    handlePopJumpIfTrueA() {
        this.processJumpOps();
    }

    handlePopJumpForwardIfFalseA() {
        this.processJumpOps();
    }

    handlePopJumpForwardIfTrueA() {
        this.processJumpOps();
    }

    handleInstrumentedPopJumpIfFalseA() {
        this.processJumpOps();
    }

    handleInstrumentedPopJumpIfTrueA() {
        this.processJumpOps();
    }

    processJumpOps() {
        if (this.skipNextJump) {
            this.skipNextJump = false;
            if (this.code.Next.OpCodeID == this.OpCodes.POP_TOP) {
                this.code.GoNext();
            }
            return;
        }
        let cond = this.dataStack.top();
        let ifblk = null;
        let popped = AST.ASTCondBlock.InitCondition.Uninited;

        if ([
                this.OpCodes.POP_JUMP_IF_FALSE_A,
                this.OpCodes.POP_JUMP_IF_TRUE_A,
                this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
                this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
                this.OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
                this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A
            ].includes(this.code.Current.OpCodeID)) {

            /* Pop condition before the jump */
            this.dataStack.pop();
            popped = AST.ASTCondBlock.InitCondition.PrePopped;
        } else if ([
            this.OpCodes.JUMP_IF_FALSE_OR_POP_A,
            this.OpCodes.JUMP_IF_TRUE_OR_POP_A,
            this.OpCodes.JUMP_IF_FALSE_A,
            this.OpCodes.JUMP_IF_TRUE_A
        ].includes(this.code.Current.OpCodeID)) {
            /* Pop condition only if condition is met */
            this.dataStack.pop();
            popped = AST.ASTCondBlock.InitCondition.Popped;
        }

        /* "Jump if true" means "Jump if not false" */
        let neg =  [
            this.OpCodes.JUMP_IF_TRUE_A, this.OpCodes.JUMP_IF_TRUE_OR_POP_A,
            this.OpCodes.POP_JUMP_IF_TRUE_A, this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_TRUE_A, this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A
        ].includes(this.code.Current.OpCodeID);

        let offs = this.code.Current.Argument;
        if (this.object.Reader.versionCompare(3, 10) >= 0)
            offs *= 2; // // BPO-27129
        if (this.object.Reader.versionCompare(3, 12) >= 0
            || [
                this.OpCodes.JUMP_IF_FALSE_A, this.OpCodes.JUMP_IF_TRUE_A,
                this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A, this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A
            ].includes(this.code.Current.OpCodeID)) {
            /* Offset is relative in these cases */
            offs += this.code.Next?.Offset;
        }

        [offs] = this.code.FindEndOfBlock(offs);

        if ([   this.OpCodes.JUMP_IF_FALSE_A,
                this.OpCodes.JUMP_IF_TRUE_A
            ].includes(this.code.Current.OpCodeID) &&
            this.code.Next?.OpCodeID == this.OpCodes.POP_TOP
        ) {
            this.code.GoNext();
        }

        if (cond instanceof AST.ASTCompare
                && cond.op == AST.ASTCompare.CompareOp.Exception) {
            if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except
                    && this.curBlock.condition == null) {
                this.blocks.pop();
                this.curBlock = this.blocks.top();
            }

            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, offs, cond.right, false);
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Else
                    && this.curBlock.size == 0) {
            /* Collapse into elif statement */
            let startOffset = this.curBlock.start;
            this.blocks.pop();
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Elif, startOffset, offs, cond, neg);
        } else if (this.curBlock.size == 0 && !this.curBlock.inited
                    && this.curBlock.blockType == AST.ASTBlock.BlockType.While
                    && this.code.Current.LineNo == this.curBlock.line) {
            /* The condition for a while loop */
            let top = this.blocks.top();
            top.condition = cond;
            top.negative = neg;
            if (popped) {
                top.init(popped);
            }
        } else if (this.curBlock.size == 0 && this.curBlock.end <= offs
                    && [ AST.ASTBlock.BlockType.If,
                            AST.ASTBlock.BlockType.Elif,
                            AST.ASTBlock.BlockType.While
                        ].includes(this.curBlock.blockType)) {
            let newcond;
            let top = this.curBlock;
            let cond1 = top.condition;
            this.blocks.pop();

            if (this.curBlock.end == offs
                    || (this.curBlock.end == this.code.Next?.Offset && !top.negative)) {
                /* if blah and blah */
                newcond = new AST.ASTBinary(cond1, cond, AST.ASTBinary.BinOp.LogicalAnd);
            } else {
                /* if <condition 1> or <condition 2> */
                newcond = new AST.ASTBinary(cond1, cond, AST.ASTBinary.BinOp.LogicalOr);
            }
            newcond.line = this.code.Current.LineNo;
            ifblk = new AST.ASTCondBlock(top.blockType, top.start, offs, newcond, neg);
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
                    && this.curBlock.comprehension
                    && this.object.Reader.versionCompare(2, 7) >= 0) {
            /* Comprehension condition */
            this.curBlock.condition = cond;
            return;
        } else {
            /* Plain old if statement */
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.If, this.code.Current.Offset, offs, cond, neg);
            ifblk.line = this.code.Current.LineNo;
        }

        if (ifblk) {
            if (popped)
                ifblk.init(popped);

            this.blocks.push(ifblk);
        }
        this.curBlock = this.blocks.top();
    }

    handleJumpAbsoluteA() {
        if (this.skipNextJump) {
            this.skipNextJump = false;
            return;
        }

        let offs = this.code.Current.Argument;
        if (this.object.Reader.versionCompare(3, 10) >= 0) {
            offs *= 2; // 2 bytes size - BPO-27129
        }

        // [offs] = this.code.FindEndOfBlock(offs);

        if (offs <= this.code.Next?.Offset) {
            if (this.curBlock.blockType == AST.ASTBlock.BlockType.For) {
                let is_jump_to_start = offs == this.curBlock.start;
                let should_pop_for_block = this.curBlock.comprehension;
                // in v3.8, SETUP_LOOP is deprecated and for blocks aren't terminated by POP_BLOCK, so we add them here
                let should_add_for_block = this.object.Reader.versionCompare(3, 8) >= 0 && is_jump_to_start && !this.curBlock.comprehension; // ||
                                        //    this.object.Reader.versionCompare(3, 8) < 0 && is_jump_to_start && this.curBlock.comprehension;

                if (should_pop_for_block || should_add_for_block) {
                    let top = this.dataStack.top();

                    if (top instanceof AST.ASTComprehension) {
                        let comp = this.dataStack.pop();            
                        comp.addGenerator(this.curBlock);
                        this.blocks.pop();
                        this.curBlock = this.blocks.top();
                        this.curBlock.append(comp);
                    } else {
                        let tmp = this.curBlock;
                        this.blocks.pop();
                        this.curBlock = this.blocks.top();
                        if (should_add_for_block ||
                            (this.curBlock === this.blocks[0] && this.curBlock.nodes.length == 0)) {
                            this.curBlock.append(tmp);
                        }
                    }
                }
            } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Else) {
                this.blocks.pop();
                this.blocks.top().append(this.curBlock);
                this.curBlock = this.blocks.top();

                if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container
                        && !this.curBlock.hasFinally) {
                    this.blocks.pop();
                    this.blocks.top().append(this.curBlock);
                    this.curBlock = this.blocks.top();
                }
            } else {
                // First of all we have to figure out if there is any While or For blocks wer are in
                let loopBlock = null;
                for (let blockIdx = this.blocks.length - 1; blockIdx > 0; blockIdx--) {
                    if ([AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.AsyncFor].includes(this.blocks[blockIdx].blockType)) {
                        loopBlock = this.blocks[blockIdx];
                        break;
                    }
                }

                if (!loopBlock) {
                    return;
                }

                if (this.curBlock.end == this.code.Next?.Offset) {
                    return;
                }

                if ([this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Prev?.OpCodeID)) {
                    return;
                }

                if (this.curBlock.nodes.top() instanceof AST.ASTKeyword) {
                    return;
                }

                if ([AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif, AST.ASTBlock.BlockType.Else].includes(this.curBlock.blockType) && this.curBlock.nodes.length == 0) {
                    this.curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
                    return;
                }

                // Let's find actual end of block
                let blockEnd = loopBlock.end;
                let instr = this.code.PeekInstructionAtOffset(blockEnd);
                let currentIndex = instr.InstructionIndex;

                while (blockEnd > loopBlock.start) {
                    if (instr.OpCodeID == this.OpCodes.JUMP_ABSOLUTE_A &&
                        (instr.JumpTarget == loopBlock.start + 3 ||
                            instr.JumpTarget < loopBlock.start)
                    ) {
                        currentIndex--;
                        instr = this.code.PeekInstructionAt(currentIndex);
                        blockEnd = instr.Offset;
                    } else {
                        return;
                    }
                }

                if (this.code.Current.Offset < blockEnd) {
                    this.curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
                }
            }

            /* We're in a loop, this jumps back to the start */
            /* I think we'll just ignore this case... */
            return; // Bad idea? Probably!
        }

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
            let cont = this.curBlock;
            // EXPERIMENT
            if (cont.hasExcept && this.code.Next?.Offset <= cont.except) {
                let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, this.code.Current.JumpTarget, null, false);
                except.init();
                this.blocks.push(except);
                this.curBlock = this.blocks.top();
            }
            return;
        }

        let prev = this.curBlock;

        if (this.blocks.length > 1) {
            do {
                this.blocks.pop();
                this.blocks.top().append(prev);

                if ([
                        AST.ASTBlock.BlockType.If,
                        AST.ASTBlock.BlockType.Elif
                    ].includes(prev.blockType)) {
                    let top = this.blocks.top();
                    let next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, top.end);
                    top.end = this.code.Current.Offset;
                    if (prev.inited == AST.ASTCondBlock.InitCondition.PrePopped) {
                        next.init(AST.ASTCondBlock.InitCondition.PrePopped);
                    }

                    this.blocks.push(next);
                    prev = null;
                } else if (prev.blockType == AST.ASTBlock.BlockType.Except) {
                    let top = this.blocks.top();
                    let next = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, top.start, top.end, null, false);
                    next.init();

                    this.blocks.push(next);
                    prev = null;
                } else if (prev.blockType == AST.ASTBlock.BlockType.Else) {
                    /* Special case */
                    if (this.blocks.top().blockType != AST.ASTBlock.BlockType.Main) {
                        prev = this.blocks.top();
                    } else {
                        prev = null;
                    }
                } else {
                    prev = null;
                }

            } while (prev != null);
        } else {
            console.error('WARNING: Trying to pop the Main block.')
        }

        this.curBlock = this.blocks.top();
    }

    handleJumpForwardA() {
        this.processJumpForward();
    }

    handleInstrumentedJumpForwardA() {
        this.processJumpForward();
    }

    processJumpForward() {
        if (this.skipNextJump) {
            this.skipNextJump = false;
            return;
        }

        let offs = this.code.Current.Argument;
        if (this.object.Reader.versionCompare(3, 10) >= 0)
            offs *= 2; // 2 bytes per offset as per BPO-27129

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
            let cont = this.curBlock;
            if (cont.hasExcept) {
                this.curBlock.end = this.code.Next?.Offset + offs;
                let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, this.curBlock.end, null, false);
                except.init();
                this.blocks.push(except);
                this.curBlock = this.blocks.top();
            }
            return;
        }

        let prev = this.curBlock;

        if (this.blocks.length > 1) {
            do {
                this.blocks.pop();

                if (!this.blocks.empty())
                    this.blocks.top().append(prev);

                if (prev.blockType == AST.ASTBlock.BlockType.If
                        || prev.blockType == AST.ASTBlock.BlockType.Elif) {
                    if (offs < 3) {
                        prev = null;
                        continue;
                    }
                    let next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, this.code.Next?.Offset + offs);
                    if (prev.inited == AST.ASTCondBlock.InitCondition.PrePopped) {
                        next.init(AST.ASTCondBlock.InitCondition.PrePopped);
                    }

                    this.blocks.push(next);
                    prev = null;
                } else if (prev.blockType == AST.ASTBlock.BlockType.Except && offs > 2) {
                    let next = null;

                    if (this.code.Next?.OpCodeID == this.OpCodes.END_FINALLY) {
                        next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, this.code.Current.JumpTarget);
                        next.init();
                    } else {
                        next = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, this.code.Next?.Offset + offs, null, false);
                        next.init();
                    }

                    this.blocks.push(next);
                    prev = null;
                } else if (prev.blockType == AST.ASTBlock.BlockType.Else) {
                    /* Special case */
                    prev = this.blocks.top();

                    if (prev.blockType == AST.ASTBlock.BlockType.Main) {
                        /* Something went out of the control! */
                        prev = null;
                    }
                } else if (prev.blockType == AST.ASTBlock.BlockType.Try
                        && prev.end < this.code.Next?.Offset + offs) {
                    this.dataStack.pop();

                    if (this.blocks.top().blockType == AST.ASTBlock.BlockType.Container) {
                        let cont = this.blocks.top();
                        if (cont.hasExcept) {

                            let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, prev.end, this.code.Next?.Offset + offs, null, false);
                            except.init();
                            this.blocks.push(except);
                        }
                    } else {
                        console.error("Something TERRIBLE happened!!\n");
                    }
                    prev = null;
                } else {
                    prev = null;
                }

            } while (prev != null);
        } else {
            console.error('WARNING: Trying to pop the Main block.');
        }

        this.curBlock = this.blocks.top();

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
            this.curBlock.end = this.code.Next?.Offset + offs;
        }
    }

    handleListAppend() {
        this.processListAppend();
    }

    handleListAppendA() {
        this.processListAppend();
    }

    processListAppend() {
        let value = this.dataStack.pop();
        let list = this.dataStack.top();

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.For && this.curBlock.comprehension) {
            this.dataStack.pop();
            let node = new AST.ASTComprehension (value);
            node.line = this.code.Current.LineNo;
            this.dataStack.push(node);
        } else {
            let node = new AST.ASTSubscr (list, value);
            node.line = this.code.Current.LineNo;
            this.dataStack.push(node);
        }
    }

    handleSetUpdateA() {
        let rhs = this.dataStack.pop();
        let lhs = this.dataStack.pop();

        if (!(rhs instanceof AST.ASTObject)) {
            fprintf(stderr, "Unsupported argument found for SET_UPDATE\n");
            return;
        }

        // I've only ever seen this be a TYPE_FROZENSET, but let's be careful...
        let obj = rhs.object;
        if (obj?.ClassType != "Py_FrozenSet") {
            console.error("Unsupported argument type found for SET_UPDATE\n");
            return;
        }

        let result = lhs.values;
        for (let value of this.object.values) {
            result.push(new AST.ASTObject (value));
        }

        let node = new AST.ASTSet (result);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleListExtendA() {
        let rhs = this.dataStack.pop();
        let lhs = this.dataStack.pop();

        if (!(rhs instanceof AST.ASTObject)) {
            fprintf(stderr, "Unsupported argument found for LIST_EXTEND\n");
            return;
        }

        // I've only ever seen this be a SMALL_TUPLE, but let's be careful...
        let obj = rhs.object;
        if (this.object.ClassType != "Py_Tuple" && this.object.ClassType != "Py_SmallTuple") {
            console.error("Unsupported argument type found for LIST_EXTEND\n");
            return;
        }

        let result = lhs.values;
        for (let value of this.object.values) {
            result.push(new AST.ASTObject(value));
        }

        let node = new AST.ASTList (result);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleLoadAttrA() {
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

    handleLoadBuildClass() {
        let node = new AST.ASTLoadBuildClass (new PycObject());
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleLoadClosureA() {
        this.dataStack.push(new AST.ASTName(this.code.Current.FreeName));
    }

    handleLoadConstA() {
        let constantObject = new AST.ASTObject(this.code.Current.ConstantObject);
        constantObject.line = this.code.Current.LineNo;

        if ((constantObject.object.ClassName == "Py_Tuple" ||
                constantObject.object.ClassName == "Py_SmallTuple") &&
                constantObject.object.Value.empty()) {
            let node = new AST.ASTTuple ([]);
            node.line = this.code.Current.LineNo;
            this.dataStack.push(node);
        } else if (constantObject.object == null || constantObject.object.ClassName == "Py_None") {
            this.dataStack.push(new AST.ASTNone());
        } else {
            this.dataStack.push(constantObject);
        }
    }

    handleLoadDerefA() {
        this.processLoadDeref();
    }

    handleLoadClassderefA() {
        this.processLoadDeref();
    }

    processLoadDeref() {
        let varName = this.code.Current.FreeName;
        if (varName.length >= 2 && varName.startsWith('_[')) {
            return;
        }
        let node = new AST.ASTName (varName);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleLoadFastA() {
        let varName = this.code.Current.Name;
        if (varName.length >= 2 && varName.startsWith('_[')) {
            return;
        }

        let node = new AST.ASTName (varName);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleLoadGlobalA() {
        let varName = this.code.Current.Name;
        if (varName.length >= 2 && varName.startsWith('_[')) {
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

    handleLoadLocals() {
        let node = new AST.ASTLocals ();
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleStoreLocals() {
        this.dataStack.pop();
    }

    handleLoadMethodA() {
        // Behave like LOAD_ATTR
        let name = this.dataStack.pop();
        let node = new AST.ASTBinary (name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleLoadNameA() {
        let varName = this.code.Current.Name;
        if (varName.length >= 2 && varName.startsWith('_[')) {
            return;
        }
        let node = new AST.ASTName (varName);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleMakeClosureA() {
        this.processMakeFunction();
    }

    handleMakeFunctionA() {
        this.processMakeFunction();
    }

    processMakeFunction() {
        let func_code = this.dataStack.pop();

        /* Test for the qualified name of the function (at TOS) */
        let tos_type = func_code.object.ClassName;
        if (!["Py_CodeObject", "Py_CodeObject2"].includes(tos_type)) {
            func_code = this.dataStack.pop();
        }
        let decompiler = new PycDecompiler(func_code.object);
        func_code.object.SourceCode = decompiler.decompile();

        let defArgs = [], kwDefArgs = [], annotations = [];
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

        let node = new AST.ASTFunction (func_code, defArgs, kwDefArgs, annotations);
        this.dataStack.push(node);
    }

    handleNop() {}

    handlePopBlock() {
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container ||
                this.curBlock.blockType == AST.ASTBlock.BlockType.Finally) {
            /* These should only be popped by an END_FINALLY */
            if (this.code.Prev?.OpCodeID == this.OpCodes.END_FINALLY && this.curBlock.blockType == AST.ASTBlock.BlockType.Container && this.curBlock.finally == this.code.Next.Offset + 3) {
                let finallyBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Finally, this.curBlock.finally, 0, true);
                this.blocks.push(finallyBlock);
                this.curBlock = this.blocks.top();
                this.code.GoNext();
            }
            return;
        }

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.With) {
            // This should only be popped by a WITH_CLEANUP
            return;
        }

        if (this.curBlock.nodes.length &&
                this.curBlock.nodes.top() instanceof AST.ASTKeyword) {
            this.curBlock.removeLast();
        }

        let tmp = this.blocks.pop();

        if (!this.blocks.empty()) {
            this.curBlock = this.blocks.top();
        }

        if (!this.blocks.empty() && !(tmp.blockType == AST.ASTBlock.BlockType.Else && tmp.nodes.empty())) {
            this.curBlock.append(tmp);
        }

        if ([AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.While].includes(tmp.blockType) && tmp.end >= this.code.Next?.Offset) {
            let blkElse = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, tmp.end);
            this.blocks.push(blkElse);
            this.curBlock = this.blocks.top();
        }

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Try
            && tmp.blockType != AST.ASTBlock.BlockType.For
            && tmp.blockType != AST.ASTBlock.BlockType.AsyncFor
            && tmp.blockType != AST.ASTBlock.BlockType.While) {
            tmp = this.curBlock;
            this.blocks.pop();
            this.curBlock = this.blocks.top();

            if (!(tmp.blockType == AST.ASTBlock.BlockType.Else
                    && tmp.nodes.empty())) {
                this.curBlock.append(tmp);
            }
        }

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {            
            if (tmp.blockType == AST.ASTBlock.BlockType.Else && !this.curBlock.hasFinally) {

                /* Pop the container */
                let cont = this.curBlock;
                this.blocks.pop();
                this.curBlock = this.blocks.top();
                this.curBlock.append(cont);

            } else if (
                (tmp.blockType == AST.ASTBlock.BlockType.Else && this.curBlock.hasFinally) ||
                (tmp.blockType == AST.ASTBlock.BlockType.Try && !this.curBlock.hasExcept)
            ) {

                let final = new AST.ASTBlock(AST.ASTBlock.BlockType.Finally, tmp.start, tmp.end, true);
                this.blocks.push(final);
                this.curBlock = this.blocks.top();
            }
        }

        if ((this.curBlock.blockType == AST.ASTBlock.BlockType.For ||
                this.curBlock.blockType == AST.ASTBlock.BlockType.AsyncFor)
            && this.curBlock.end == this.code.Next?.Offset) {
            this.blocks.pop();
            this.blocks.top().append(this.curBlock);
            this.curBlock = this.blocks.top();
        }

        if (this.blocks.empty() && tmp.blockType == AST.ASTBlock.BlockType.Main) {
            this.blocks.push(tmp);
            this.curBlock = this.blocks.top();
        }
    }

    handlePopExcept() {}

    handlePopTop() {
        if (!(this.dataStack.top() instanceof AST.ASTComprehension) && [this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A, this.OpCodes.POP_JUMP_IF_FALSE_A, this.OpCodes.JUMP_IF_FALSE_A].includes(this.code.Prev?.OpCodeID)) {
            if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
                // Skipping POP_TOP, POP_TOP, POP_TOP
                if ([this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Prev.OpCodeID)) {
                    if (this.code.Next?.OpCodeID == this.OpCodes.POP_TOP && this.code.Next?.Next?.OpCodeID == this.OpCodes.POP_TOP) {
                        this.code.GoNext(2);
                    }
                } else if (this.code.Prev.OpCodeID == this.OpCodes.POP_JUMP_IF_FALSE_A) {
                    if ([this.OpCodes.STORE_NAME_A, this.OpCodes.STORE_FAST_A].includes(this.code.Next?.OpCodeID) && this.code.Next?.Next?.OpCodeID == this.OpCodes.POP_TOP) {
                        let exceptionTypeNode = this.curBlock.condition;
                        if (!(exceptionTypeNode instanceof AST.ASTName)) {
                            console.error(`Expected ASTName, but got ${exceptionTypeNode.constructor.name}`);
                            return;
                        }
                        let exceptionName = new AST.ASTName(this.code.Next.Name);
                        exceptionName.line = this.code.Current.LineNo;
                        this.curBlock.condition = new AST.ASTStore(exceptionTypeNode, exceptionName);
                        this.code.GoNext(2);
                    }
                } else if (this.code.Prev.OpCodeID == this.OpCodes.JUMP_IF_FALSE_A) {
                    if ( this.code.Next?.OpCodeID == this.OpCodes.POP_TOP && [this.OpCodes.STORE_NAME_A, this.OpCodes.STORE_FAST_A].includes(this.code.Next?.Next?.OpCodeID) && this.code.Next?.Next?.Next?.OpCodeID == this.OpCodes.POP_TOP) {
                        let exceptionTypeNode = this.curBlock.condition;
                        if (!(exceptionTypeNode instanceof AST.ASTName)) {
                            console.error(`Expected ASTName, but got ${exceptionTypeNode.constructor.name}`);
                            return;
                        }
                        let exceptionName = new AST.ASTName(this.code.Next.Next.Name);
                        exceptionName.line = this.code.Current.LineNo;
                        this.curBlock.condition = new AST.ASTStore(exceptionTypeNode, exceptionName);
                        this.code.GoNext(2);
                    }
                }
            }
            return;
        } else if ([this.OpCodes.PRINT_ITEM_TO].includes(this.code.Prev.OpCodeID) && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
            let printNode = this.curBlock.nodes.top();
            if (printNode.stream && printNode.stream == this.dataStack.top()) {
                this.dataStack.pop();
                return;
            }
        }
        let value = this.dataStack.pop();
        if (!this.curBlock.inited) {
            if (this.curBlock.blockType == AST.ASTBlock.BlockType.With) {
                this.curBlock.expr = value;
            } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.If && !this.curBlock.condition) {
                this.curBlock.condition = value;
            }
            this.curBlock.init();
        } else if (value == null || value.processed) {
            return;
        }

        if (!(value instanceof AST.ASTObject)) {
            this.curBlock.append(value);
        }

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
                && this.curBlock.comprehension) {
            /* This relies on some really uncertain logic...
                * If it's a comprehension, the only POP_TOP should be
                * a call to append the iter to the list.
                */
            if (value instanceof AST.ASTCall) {
                let pparams = value.pparams;
                if (!pparams.empty()) {
                    let res = pparams[0];
                    let node = new AST.ASTComprehension (res);
                    node.line = this.code.Current.LineNo;
                    this.dataStack.push(node);
                }
            }
        }
    }

    handlePrintExpr() {
        this.processPrint();
    }

    handlePrintItem() {
        this.processPrint();
    }

    processPrint() {
        let printNode;
        if (this.curBlock.nodes.length > 0 && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
            printNode = this.curBlock.nodes.top();
        }
        if (printNode && printNode.stream == null && !printNode.eol) {
            printNode.add(this.dataStack.pop());
        } else {
            let node = new AST.ASTPrint(this.dataStack.pop());
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }

    handlePrintItemTo() {
        let stream = this.dataStack.pop();
        let printNode;

        if (this.curBlock.nodes.length > 0 && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
            printNode = this.curBlock.nodes.top();
        }

        if (printNode && printNode.stream == stream && !printNode.eol) {
            printNode.add(this.dataStack.pop());
        } else {
            let node = new AST.ASTPrint(this.dataStack.pop(), stream);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }

    handlePrintNewline() {
        let printNode;
        if (!this.curBlock.empty() && this.curBlock.nodes.top() instanceof AST.ASTPrint)
            printNode = this.curBlock.nodes.top();
        if (printNode && printNode.stream == null && !printNode.eol)
            printNode.eol = true;
        else {
            let node = new AST.ASTPrint();
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
        this.dataStack.pop();
    }

    handlePrintNewlineTo() {
        let stream = this.dataStack.pop();

        let printNode;
        if (!this.curBlock.empty() && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
            printNode = this.curBlock.nodes.top();
        }

        if (printNode && printNode.stream == stream && !printNode.eol) {
            printNode.eol = true;
        } else {
            let node = new AST.ASTPrint(null, stream);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
        this.dataStack.pop();
    }

    handleRaiseVarargsA() {
        let paramList = [];
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            paramList.unshift(this.dataStack.pop());
        }
        let node = new AST.ASTRaise(paramList);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);

        if ((this.curBlock.blockType == AST.ASTBlock.BlockType.If
                || this.curBlock.blockType == AST.ASTBlock.BlockType.Else)
                && (this.object.Reader.versionCompare(2, 6) >= 0)) {            
            let prev = this.curBlock;
            this.blocks.pop();
            this.curBlock = this.blocks.top();
            this.curBlock.append(prev);

            this.code.GoNext();
        }
    }

    handleInstrumentedReturnValueA() {
        this.handleReturnValue();
    }

    handleReturnValue() {
        let value = this.dataStack.pop();
        if (value == null) {
            value = new AST.ASTNone();
        }
        let node = new AST.ASTReturn(value);
        node.inLambda = this.object.Name == '<lambda>';
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);

        if ([AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Else].includes(this.curBlock.blockType)
            && (this.object.Reader.versionCompare(2, 6) >= 0)) {
            let prev = this.curBlock;
            this.blocks.pop();
            this.curBlock = this.blocks.top();
            if (
                prev instanceof AST.ASTCondBlock &&
                prev.nodes.length == 1 &&
                prev.line == value.line
            ) {
                prev = new AST.ASTReturn(new AST.ASTBinary(prev.condition, value, prev.negative ? AST.ASTBinary.BinOp.LogicalOr : AST.ASTBinary.BinOp.LogicalAnd));
            }

            this.curBlock.append(prev);

            if ([this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Next?.OpCodeID)) {
                this.code.GoNext();
            }
        }
    }

    handleInstrumentedReturnConstA() {
        this.handleReturnConstA();
    }
    
    handleReturnConstA() {
        let value = new AST.ASTObject(this.code.Current.ConstantObject);
        let node = new AST.ASTReturn(value);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleRotTwo() {
        let one = this.dataStack.pop();
        if (this.dataStack.top() instanceof AST.ASTChainStore) {
            this.dataStack.pop();
        }
        let two = this.dataStack.pop();

        this.dataStack.push(one);
        this.dataStack.push(two);
    }

    handleRotThree() {
            let one = this.dataStack.pop();
            let two = this.dataStack.pop();
            if (this.dataStack.top() instanceof AST.ASTChainStore) {
                this.dataStack.pop();
            }
            let three = this.dataStack.pop();
            this.dataStack.push(one);
            this.dataStack.push(three);
            this.dataStack.push(two);
        }

    handleRotFour() {
        let one = this.dataStack.pop();
        let two = this.dataStack.pop();
        let three = this.dataStack.pop();
        if (this.dataStack.top() instanceof AST.ASTChainStore) {
            this.dataStack.pop();
        }
        let four = this.dataStack.pop();
        this.dataStack.push(one);
        this.dataStack.push(four);
        this.dataStack.push(three);
        this.dataStack.push(two);
    }

    handleSetLinenoA() {}

    handleSetupWithA() {
        let withBlock = new AST.ASTWithBlock(this.code.Current.Offset, this.code.Current.JumpTarget);
        this.blocks.push(withBlock);
        this.curBlock = this.blocks.top();
    }

    handleWithCleanupStart() {
        this.handleWithCleanup();
    }

    handleWithCleanup() {
        // Stack top should be a None. Ignore it.
        let none = this.dataStack.pop();

        if (!(none instanceof AST.ASTNone)) {
            console.error("Something TERRIBLE happened!\n");
            return;
        }

        if (this.curBlock.blockType == AST.ASTBlock.BlockType.With
                && this.curBlock.end == this.code.Current.Offset) {
            let withBlock = this.curBlock;
            this.curBlock = this.blocks.pop();
            this.curBlock.append(withBlock);
        }
        else {
            console.error(`Something TERRIBLE happened! No matching with block found for WITH_CLEANUP at ${this.code.Current.Offset}\n`);
        }
    }

    handleWithCleanupFinish() {
                /* Ignore this */
    }

    handleSetupExceptA() {
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container && this.curBlock.line > -1 && this.curBlock.line == this.code.Current.LineNo) {
            this.curBlock.except = this.code.Current.JumpTarget;
        } else if (this.code.Prev?.OpCodeID == this.OpCodes.SETUP_FINALLY_A && this.code.Prev.LineNo > -1 && this.code.Prev.LineNo != this.code.Current.LineNo) {
            let nextBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, this.code.Prev.Offset, this.code.Prev.JumpTarget, true);
            this.blocks.push(nextBlock);
            nextBlock = new AST.ASTContainerBlock(this.code.Current.Offset, 0, this.code.Current.JumpTarget);
            this.blocks.push(nextBlock);
        } else {
            let nextBlock = new AST.ASTContainerBlock(this.code.Current.Offset, 0, this.code.Current.JumpTarget);
            this.blocks.push(nextBlock);
        }

        let tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, this.code.Current.Offset, this.code.Current.JumpTarget, true);
        this.blocks.push(tryBlock);
        this.curBlock = this.blocks.top();

        this.need_try = false;
    }

    handleSetupFinallyA() {
        let nextBlock = new AST.ASTContainerBlock(this.code.Current.Offset, this.code.Current.JumpTarget);
        nextBlock.line = this.code.Current.LineNo;
        this.blocks.push(nextBlock);
        this.curBlock = this.blocks.top();

        this.need_try = true;
    }

    handleSetupLoopA() {
        let nextBlock = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, this.code.Current.Offset, this.code.Current.JumpTarget, null, false);
        nextBlock.line = this.code.Current.LineNo;
        this.blocks.push(nextBlock);
        this.curBlock = this.blocks.top();
    }

    handleSlice0() {
        let name = this.dataStack.pop();
        if (name instanceof AST.ASTChainStore) {
            name = name.source;
        }

        let sliceNode = new AST.ASTSlice (AST.ASTSlice.SliceOp.Slice0);
        let node = new AST.ASTSubscr (name, sliceNode);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleSlice1() {
        let lower = this.dataStack.pop();
        let name = this.dataStack.pop();

        let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, lower);
        let node = new AST.ASTSubscr(name, sliceNode);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleSlice2() {
        let upper = this.dataStack.pop();
        let name = this.dataStack.pop();

        let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, null, upper);
        let node = new AST.ASTSubscr(name, sliceNode);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);    
    }

    handleSlice3() {
        let upper = this.dataStack.pop();
        let lower = this.dataStack.pop();
        let name = this.dataStack.pop();

        let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, lower, upper);
        let node = new AST.ASTSubscr(name, sliceNode);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);    
    }

    handleStoreAttrA() {
        if (this.unpack) {
            let name = this.dataStack.pop();
            let attrNode = new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);

            let tup = this.dataStack.top();
            if (tup instanceof AST.ASTTuple) {
                tup.add(attrNode);
            } else {
                console.error("Something TERRIBLE happened!\n");
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

    handleStoreDerefA() {
        if (this.unpack) {
            let nameNode = new AST.ASTName(this.code.Current.FreeName);
            let tupleNode = this.dataStack.top();
            if (tupleNode instanceof AST.ASTTuple)
                tupleNode.add(nameNode);
            else
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
            let valueNode = this.dataStack.pop();
            let nameNode = new AST.ASTName(this.code.Current.FreeName);

            if (valueNode instanceof AST.ASTChainStore) {
                this.append_to_chain_store(valueNode, nameNode);
            } else {
                let node = new AST.ASTStore(valueNode, nameNode);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    }

    handleStoreFastA() {
        this.processStore();
    }

    handleStoreGlobalA() {
        this.processStore();
    }

    handleStoreNameA() {
        this.processStore();
    }

    processStore() {
        if (this.unpack) {
            let nameNode = new AST.ASTName(this.code.Current.Name);

            let tupleNode = this.dataStack.top();
            if (tupleNode instanceof AST.ASTTuple) {
                if (this.starPos-- == 0) {
                    nameNode.name = '*' + nameNode.name;
                }
                tupleNode.add(nameNode);
            } else {
                console.error("Something TERRIBLE happened!\n");
            }
            
            if (--this.unpack <= 0) {
                this.dataStack.pop();
                let seqNode = this.dataStack.pop();

                if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
                        && !this.curBlock.inited) {
                    let tuple = tupleNode;
                    if (tuple != null) {
                        tuple.requireParens = false;
                    }
                    this.curBlock.index = tupleNode;
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
            let varName = this.code.Current.Name;
            if (varName.length >= 2 && varName.startsWith('_[')) {
                /* Don't show stores of list comp append objects. */
                return;
            }

            // Return private names back to their original name
            let class_prefix = "_" + this.code.Current.Name;
            if (varName.startsWith(class_prefix + "__")) {
                varName.value = varName.substring(class_prefix.length);
            }

            let nameNode = new AST.ASTName(varName);
            nameNode.line = this.code.Current.LineNo;

            if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
                    && !this.curBlock.inited) {
                this.curBlock.index = nameNode;
                this.curBlock.init();
            } else if (this.dataStack.top() instanceof AST.ASTImport) {
                let valueNode = this.dataStack.pop();
                let importNode = this.dataStack.top();
                let storeNode = new AST.ASTStore(valueNode, nameNode);
                storeNode.line = this.code.Current.LineNo;
                importNode.add_store(storeNode);
            } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.With
                        && !this.curBlock.inited) {
                let valueNode = this.dataStack.pop();
                this.curBlock.expr = valueNode;
                this.curBlock.var = nameNode;
                this.curBlock.init();
            } else if (this.dataStack.top() instanceof AST.ASTChainStore) {
                let valueNode = this.dataStack.pop();
                this.append_to_chain_store(valueNode, nameNode);
                if (this.code.Prev.OpCodeID != this.OpCodes.DUP_TOP) {
                    this.curBlock.append(valueNode);
                }
            } else {
                let valueNode = this.dataStack.pop();
                if (valueNode instanceof AST.ASTFunction && !valueNode.code.object.SourceCode) {
                    let decompiler = new PycDecompiler(valueNode.code.object);
                    valueNode.code.object.SourceCode = decompiler.decompile();
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

    handleStoreSlice0() {
        let destNode = this.dataStack.pop();
        let valueNode = this.dataStack.pop();
        let node = new AST.ASTStore(valueNode,
                        new AST.ASTSubscr(destNode,
                            new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice0)
                        )
                    );
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleStoreSlice1() {
        let upper = this.dataStack.pop();
        let dest = this.dataStack.pop();
        let value = this.dataStack.pop();
        let node = new AST.ASTStore(value,
            new AST.ASTSubscr(dest,
                new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, upper)
            )
        );
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleStoreSlice2() {
        let lowerNode = this.dataStack.pop();
        let destNode = this.dataStack.pop();
        let valueNode = this.dataStack.pop();
        let node = new AST.ASTStore(valueNode,
            new AST.ASTSubscr(destNode,
                new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, null, lowerNode)));
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleStoreSlice3() {
        let lowerNode = this.dataStack.pop();
        let upperNode = this.dataStack.pop();
        let destNode = this.dataStack.pop();
        let valueNode = this.dataStack.pop();
        let node = new AST.ASTStore(valueNode,
            new AST.ASTSubscr(destNode,
                new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, upperNode, lowerNode)));
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleStoreSubscr() {
        if (this.unpack) {
            let subscrNode = this.dataStack.pop();
            let destNode = this.dataStack.pop();

            let saveNode = new AST.ASTSubscr(destNode, subscrNode);

            let tupleNode = this.dataStack.top();
            if (tupleNode instanceof AST.ASTTuple)
                tupleNode.add(saveNode);
            else
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
            let subscrNode = this.dataStack.pop();
            let destNode = this.dataStack.pop();
            let srcNode = this.dataStack.pop();

            // If variable annotations are enabled, we'll need to check for them here.
            // Python handles a varaible annotation by setting:
            // __annotations__['var-name'] = type
            let found_annotated_var = (this.variable_annotations && destNode instanceof AST.ASTName
                && destNode.name == "__annotations__");

            if (found_annotated_var) {
                // Annotations can be done alone or as part of an assignment.
                // In the case of an assignment, we'll see a NODE_STORE on the this.dataStack.
                if (!this.curBlock.nodes.empty() && this.curBlock.nodes.top() instanceof AST.ASTStore) {
                    // Replace the existing NODE_STORE with a new one that includes the annotation.
                    let store = this.curBlock.nodes.top();
                    this.curBlock.removeLast();
                    let node = new AST.ASTStore(store.src,
                        new AST.ASTAnnotatedVar(subscrNode, srcNode)
                    );
                    node.line = this.code.Current.LineNo;
                    this.curBlock.append(node);
                } else {
                    let node = new AST.ASTAnnotatedVar(subscrNode, srcNode);
                    node.line = this.code.Current.LineNo;
                    this.curBlock.append(node);
                }
            } else {
                if (destNode instanceof AST.ASTMap) {
                    destNode.add(subscrNode, srcNode);
                } else if (srcNode instanceof AST.ASTChainStore) {
                    this.append_to_chain_store(srcNode, new AST.ASTSubscr(destNode, subscrNode));
                } else {
                    let node = new AST.ASTStore(srcNode,
                        new AST.ASTSubscr(destNode, subscrNode)
                    );
                    node.line = this.code.Current.LineNo;
                    this.curBlock.append(node);
                }
            }
        }
    }

    handleUnaryCall() {
        let funcNode = this.dataStack.pop();
        let node = new AST.ASTCall(funcNode, [], []);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleUnaryConvert() {
        let name = this.dataStack.pop();
        let node = new AST.ASTConvert(name);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }

    handleUnaryInvert() {
        let arg = this.dataStack.pop();
        let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Invert);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);    
    }

    handleUnaryNegative() {
        let arg = this.dataStack.pop();
        let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Negative);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);    
    }

    handleUnaryNot() {
        let arg = this.dataStack.pop();
        let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Not);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);    
    }

    handleUnaryPositive() {
        let arg = this.dataStack.pop();
        let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Positive);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);    
    }

    handleUnpackListA() {
        this.processUnpack();
    }

    handleUnpackTupleA() {
        this.processUnpack();
    }

    handleUnpackSequenceA() {
        this.processUnpack();
    }

    processUnpack() {
        this.unpack = this.code.Current.Argument;
        if (this.unpack > 0) {
            let node = new AST.ASTTuple([]);
            node.line = this.code.Current.LineNo;
            this.dataStack.push(node);    
        } else {
            // Unpack zero values and assign it to top of stack or for loop variable.
            // E.g. [] = TOS / for [] in X
            let tupleNode = new AST.ASTTuple([]);
            if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
                && !this.curBlock.inited) {
                tupleNode.requireParens = true;
                this.curBlock.index = tupleNode;
            } else if (this.dataStack.top() instanceof AST.ASTChainStore) {
                let chainStore = this.dataStack.pop();
                chainStore.line = this.code.Current.LineNo;
                this.append_to_chain_store(chainStore, tupleNode);
            } else {
                let node = new AST.ASTStore(this.dataStack.pop(), tupleNode);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    }

    handleYieldFrom() {
        let dest = this.dataStack.pop();
        // TODO: Support yielding into a non-null destination
        let valueNode = this.dataStack.top();
        if (valueNode) {
            let node = new AST.ASTReturn(valueNode, AST.ASTReturn.RetType.YieldFrom);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }

    handleInstrumentedYieldValueA() {
        this.handleYieldValue();
    }

    handleYieldValue() {
        let value = this.dataStack.pop();
        let node = new AST.ASTReturn(value, AST.ASTReturn.RetType.Yield);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }

    handleSetupAnnotations() {
        this.variable_annotations = true;
    }

    handlePrecallA() {}

    handleResumeA() {}

    handleInstrumentedResumeA() {}

    handleCache() {
                /* These "fake" opcodes are used as placeholders for optimizing
                   certain opcodes in Python 3.11+.  Since we have no need for
                   that during disassembly/decompilation, we can just treat these
                   as no-ops. */
    }
    handlePushNull() {
        this.dataStack.push(null);
    }

    handleGenStartA() {
        this.dataStack.pop();
    }

    handleReserveFastA() {
        let list = [];
        this.code.Current.ConstantObject.Value.map(el => list[el.value] = el.key);
        this.dataStack.push(list);
    }

    handleUnpackArgA() {
        let data = this.dataStack.pop();
        this.object.ArgCount = this.code.Current.Argument;
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {                                
            this.object.VarNames.Value.push(data[idx]);
        }
        this.code.GoNext(this.code.Current.Argument);
    }

    handleBinaryCall() {
        let paramsTuple = this.dataStack.pop();
        let func = this.dataStack.pop();
        let params = [];

        if (paramsTuple instanceof AST.ASTTuple) {
            params = paramsTuple.values;
        }

        let callNode = new AST.ASTCall(func, params);
        this.dataStack.push(callNode);
    }

    handleUnpackExA() {
        this.unpack = (this.code.Current.Argument & 0xFF);
        this.starPos = this.unpack;
        this.unpack += 1 + (this.code.Current.Argument >> 8) & 0xFF;

        let source = this.dataStack.pop();
        let tuple = new AST.ASTTuple([]);
        tuple.requireParens = false;
        this.dataStack.push(new PycObject("Py_Null"));
        this.dataStack.push(new AST.ASTChainStore([], source));
        this.dataStack.push(tuple);
    }

    handleBuildListUnpackA() {
        this.processBuild();
    }

    handleBuildTupleUnpackA() {
        this.processBuild();
    }

    processBuild() {
        let values = [];
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            values.unshift(this.dataStack.pop());
        }
        let listNode = new AST.ASTList(values); // Or ASTTuple based on opcode
        this.dataStack.push(listNode);
    }

    handleBuildSetUnpackA() {
        let values = [];
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            values.unshift(this.dataStack.pop());
        }
        let setNode = new AST.ASTSet(values);
        this.dataStack.push(setNode);
    }

    handleBuildMapUnpackA() {
        this.processBuildMapUnpack();
    }

    handleBuildMapUnpackWithCallA() {
        this.processBuildMapUnpack();
    }

    processBuildMapUnpack() {
        let mapNode = new AST.ASTMap();
        for (let idx = 0; idx < this.code.Current.Argument; idx++) {
            let pair = this.dataStack.pop(); // Should be a dictionary
            if (pair instanceof AST.ASTMap) {
                for (const entry of pair.values) {
                    mapNode.add(entry.key, entry.value);
                }
            } else {
                console.error("Expected a map for BUILD_MAP_UNPACK");
            }
        }
        this.dataStack.push(mapNode);
    }

    handleSetupAsyncWithA() {
        let asyncWithBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.AsyncWith, this.code.Current.Offset, this.code.Current.JumpTarget);
        this.blocks.push(asyncWithBlock);
        this.curBlock = this.blocks.top();
    }

    handleCallFunctionExA() {
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

    handleBeginFinally() {
        // I might need to adjust your SETUP_FINALLY_A logic based on this
    }

    handleEndAsyncFor() {
        // Ensure that AsyncFor block handling uses this
    }

    handleCallFinallyA() {
        // TODO: Implement logic for calling finally block
        console.log("OpCode CALL_FINALLY_A needs implementation");
    }
    handlePopFinallyA() {
        // Logic might be needed within your END_FINALLY handling
    }

    handleWithExceptStart() {
        // TODO: Adjust your SETUP_WITH_A logic to handle exceptions
        console.log("OpCode WITH_EXCEPT_START needs implementation");
    }

    handleLoadAssertionError() {
        this.dataStack.push(new AST.ASTName("AssertionError"));
    }

    handleListToTuple() {
        let listNode = this.dataStack.pop();
        if (listNode instanceof AST.ASTList) {
            this.dataStack.push(new AST.ASTTuple(listNode.values));
        } else {
            console.error("Expected ASTList for LIST_TO_TUPLE");
        }
    }

    handleDictMergeA() {
        let dictToMerge = this.dataStack.pop();
        let targetDict = this.dataStack.top();
        if (targetDict instanceof AST.ASTMap && dictToMerge instanceof AST.ASTMap) {
            for (const entry of dictToMerge.values) {
                targetDict.add(entry.key, entry.value);
            }
        } else {
            console.error("Expected ASTMap for DICT_MERGE_A");
        }
    }

    handleDictUpdateA() {
        let updateSource = this.dataStack.pop();
        let targetDict = this.dataStack.top();
        if (targetDict instanceof AST.ASTMap) {
            if (updateSource instanceof AST.ASTMap) {
                for (const entry of updateSource.values) {
                    targetDict.add(entry.key, entry.value);
                }
            } else if (updateSource instanceof AST.ASTCall && updateSource.func instanceof AST.ASTName && updateSource.func.name == 'zip') {
                // Handle case where updateSource is a zip of keys and values
                if (updateSource.pparams.length === 2) {
                    let keys = updateSource.pparams[0];
                    let values = updateSource.pparams[1];
                    if (keys instanceof AST.ASTList && values instanceof AST.ASTList && keys.values.length === values.values.length) {
                        for (let i = 0; i < keys.values.length; i++) {
                            targetDict.add(keys.values[i], values.values[i]);
                        }
                    } else if (keys instanceof AST.ASTTuple && values instanceof AST.ASTTuple && keys.values.length === values.values.length) {
                        for (let i = 0; i < keys.values.length; i++) {
                            targetDict.add(keys.values[i], values.values[i]);
                        }
                    } else {
                        console.error("Expected lists or tuples of equal length for zip in DICT_UPDATE_A");
                    }
                }
            } else {
                // TODO: Handle iterable of key-value pairs
                console.error("Expected ASTMap or iterable for DICT_UPDATE_A");
            }
        } else {
            console.error("Expected ASTMap for DICT_UPDATE_A target");
        }
    }

    handleJumpIfNotExcMatchA() {
        // TODO: Implement logic for exception matching in jumps
        console.log("OpCode JUMP_IF_NOT_EXC_MATCH_A needs implementation");
    }
}

module.exports = PycDecompiler;
