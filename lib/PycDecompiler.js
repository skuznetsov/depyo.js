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

    static Decompile (obj) {
        if (obj == null) {
            return null;
        }

        OpCodes = obj.Reader.OpCodes;
        let code = new OpCodes(obj);
        let DataStack = [];
        let funcBody = PycDecompiler.Stmts(obj, code, DataStack);

        if (obj.Name != "<lambda>" && funcBody.last instanceof AST.ASTReturn && funcBody.last.value instanceof AST.ASTNone) {
            funcBody.list.pop();
        }

        if (funcBody.list.length == 0) {
            funcBody.list.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
        }


        return funcBody;
    }

    static append_to_chain_store(chainStore, item, DataStack, curBlock)
    {
        if (DataStack.top() == item) {
            DataStack.pop();    // ignore identical source object.
        }
        chainStore.append(item);
        if (DataStack.top()?.ClassName == "Py_Null") {
            curBlock.append(chainStore);
        } else {
            DataStack.push(chainStore);
        }
    }

    static CheckIfExpr(DataStack, curBlock)
    {
        if (DataStack.empty())
            return;
        if (curBlock.nodes.length < 2)
            return;
        let rit = curBlock.nodes[curBlock.nodes.length - 1];
        // the last is "else" block, the one before should be "if" (could be "for", ...)
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.Else)
            return;
        rit = curBlock.nodes[curBlock.nodes.length - 2];
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.If)
            return;
        let else_expr = DataStack.pop();
        curBlock.removeLast();
        let if_block = curBlock.nodes.top();
        let if_expr = DataStack.pop();
        if (if_expr == null && if_block.nodes.length == 1) {
            if_expr = if_block.nodes[0];
            if_block.nodes.length = 0;
        }
        curBlock.removeLast();
        DataStack.push(new AST.ASTTernary(if_block, if_expr, else_expr));
    }
    

    static Stmts (obj, code, DataStack, endOffset = 0) {
        let nextOpCode = null;

        if (obj == null) {
            return null;
        }

        let blocks = [];
        let unpack = 0;
        let starPos = -1;
        let skipNextJump = false;
        let else_pop = false;
        let variable_annotations = false;
        let need_try = false;
        let defBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Main);
        defBlock.init();
        let curBlock = defBlock;
        blocks.push(defBlock);
    
        while (code.HasInstructionsToProcess) {                
            try {                
                code.GoNext();

                if (need_try && code.Current.OpCodeID != OpCodes.SETUP_EXCEPT_A) {
                    need_try = false;
        
                    let tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, code.Current.Offset, curBlock.end, true);
                    blocks.push(tryBlock);
                    curBlock = blocks.top();
                } else if (
                    else_pop &&
                    ![
                        OpCodes.JUMP_FORWARD_A,
                        OpCodes.JUMP_IF_FALSE_A,
                        OpCodes.JUMP_IF_FALSE_OR_POP_A,
                        OpCodes.POP_JUMP_IF_FALSE_A,
                        OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
                        OpCodes.JUMP_IF_TRUE_A,
                        OpCodes.JUMP_IF_TRUE_OR_POP_A,
                        OpCodes.POP_JUMP_IF_TRUE_A,
                        OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
                        OpCodes.POP_BLOCK
                    ].includes(code.Current.OpCodeID)
                ) {
                    else_pop = false;
        
                    let prev = curBlock;
                    while (prev.end < code.Next?.Offset && prev.blockType != AST.ASTBlock.BlockType.Main) {
                        if (prev.blockType != AST.ASTBlock.BlockType.Container) {
                            if (prev.end == 0) {
                                break;
                            }
                        }
                        blocks.pop();
        
                        if (blocks.empty())
                            break;
        
                        curBlock = blocks.top();
                        curBlock.append(prev);
        
                        prev = curBlock;
        
                        PycDecompiler.CheckIfExpr(DataStack, curBlock);
                    }
                }
        
                switch (code.Current.OpCodeID)
                {
                    case OpCodes.BINARY_OP_A:
                    {
                        let rVal = DataStack.pop();
                        let lVal = DataStack.pop();
                        let op = AST.ASTBinary.from_binary_op(code.Current.Argument);
                        if (op == AST.ASTBinary.BinOp.InvalidOp) {
                            // TODO: Throw and handle proper exeception.
                            throw new SyntaxError("Invalid op");
                        }
                        let node = new AST.ASTBinary(lVal, rVal,op);
                        node.line = code.Current.LineNo;
                        DataStack.push(node);
                    }
                    break;
                    case OpCodes.BINARY_ADD:
                    case OpCodes.BINARY_AND:
                    case OpCodes.BINARY_DIVIDE:
                    case OpCodes.BINARY_FLOOR_DIVIDE:
                    case OpCodes.BINARY_LSHIFT:
                    case OpCodes.BINARY_MODULO:
                    case OpCodes.BINARY_MULTIPLY:
                    case OpCodes.BINARY_OR:
                    case OpCodes.BINARY_POWER:
                    case OpCodes.BINARY_RSHIFT:
                    case OpCodes.BINARY_SUBTRACT:
                    case OpCodes.BINARY_TRUE_DIVIDE:
                    case OpCodes.BINARY_XOR:
                    case OpCodes.BINARY_MATRIX_MULTIPLY:
                    case OpCodes.INPLACE_ADD:
                    case OpCodes.INPLACE_AND:
                    case OpCodes.INPLACE_DIVIDE:
                    case OpCodes.INPLACE_FLOOR_DIVIDE:
                    case OpCodes.INPLACE_LSHIFT:
                    case OpCodes.INPLACE_MODULO:
                    case OpCodes.INPLACE_MULTIPLY:
                    case OpCodes.INPLACE_OR:
                    case OpCodes.INPLACE_POWER:
                    case OpCodes.INPLACE_RSHIFT:
                    case OpCodes.INPLACE_SUBTRACT:
                    case OpCodes.INPLACE_TRUE_DIVIDE:
                    case OpCodes.INPLACE_XOR:
                    case OpCodes.INPLACE_MATRIX_MULTIPLY:
                    {
                        let rVal = DataStack.pop();
                        let lVal = DataStack.pop();
                        let op = AST.ASTBinary.from_opcode(code.Current.OpCodeID);
                        if (op == AST.ASTBinary.BinOp.InvalidOp) {
                            // TODO: Throw and handle proper exeception.
                            throw new SyntaxError("Invalid op");
                        }
                        let node = new AST.ASTBinary(lVal, rVal,op);
                        node.line = code.Current.LineNo;
                        DataStack.push(node);
                    }
                    break;
                    case OpCodes.BINARY_SUBSCR:
                    {
                        let subscr = DataStack.pop();
                        let src = DataStack.pop();
                        let node = new AST.ASTSubscr(src, subscr);
                        node.line = code.Current.LineNo;
                        DataStack.push(node);
                    }
                    break;
                    case OpCodes.BREAK_LOOP:
                    {
                        let keywordNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Break);
                        keywordNode.line = code.Current.LineNo;
                        curBlock.append(keywordNode);
                    }
                    break;
                    case OpCodes.BUILD_CLASS:
                    {
                        let classCode = DataStack.pop();
                        let bases = DataStack.pop();
                        let name = DataStack.pop();
                        let classNode = new AST.ASTClass(classCode, bases, name);
                        DataStack.push(classNode);
                    }
                    break;
                    case OpCodes.BUILD_FUNCTION:
                    {
                        let functionCode = DataStack.pop();
                        let functionNode = new AST.ASTFunction(functionCode);
                        DataStack.push(functionNode);
                    }
                    break;
                    case OpCodes.BUILD_LIST_A:
                    {
                        let values = [];

                        for (let idx = code.Current.Argument - 1; idx >= 0; idx--) {
                            values[idx] = DataStack.pop();
                        }

                        let listNode = new AST.ASTList(values);
                        DataStack.push(listNode);
                    }
                    break;
                    case OpCodes.BUILD_SET_A:
                    {
                        let values = [];

                        for (let idx = code.Current.Argument - 1; idx >= 0; idx--) {
                            values[idx] = DataStack.pop();
                        }

                        let listNode = new AST.ASTSet(values);
                        DataStack.push(listNode);
                        if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                            code.GoNext();
                        }
                    }
                    break;
                    case OpCodes.SET_ADD:
                    {
                        let value = DataStack.pop();
                        let setNode = DataStack.top();
                        if (curBlock.blockType == AST.ASTBlock.BlockType.For && curBlock.comprehension) {
                            DataStack.pop();
                            let node = new AST.ASTComprehension (value);
                            node.line = code.Current.LineNo;
                            node.kind = AST.ASTComprehension.SET;
                            DataStack.push(node);
                        } else {
                            setNode.add(value);
                        }
                    }
                    break;    
                    case OpCodes.BUILD_MAP_A:
                    {
                        if (obj.Reader.versionCompare(3, 5) >= 0) {
                            let mapNode = new AST.ASTMap();
                            mapNode.line = code.Current.LineNo;
                            DataStack.push(mapNode);

                            for (let idx = 0; idx < code.Current.Argument; idx++) {
                                let value = DataStack.pop();
                                let key = DataStack.pop();
                                mapNode.add(key, value);
                            }
                        } else {
                            if (DataStack.top() instanceof AST.ASTChainStore) {
                                DataStack.pop();
                            }

                            let mapNode = new AST.ASTMap();
                            mapNode.line = code.Current.LineNo;
                            DataStack.push(mapNode);
                        }
                    }
                    break;
                    case OpCodes.BUILD_CONST_KEY_MAP_A:
                    {
                        let values = [];
                        let keys = DataStack.pop();
                        for (let idx = 0; idx < code.Current.Argument; idx++) {
                            values.push(DataStack.pop());
                        }

                        let mapNode = new AST.ASTConstMap(keys, values);
                        mapNode.line = code.Current.LineNo;
                        DataStack.push(mapNode);
                    }
                    break;
                    case OpCodes.MAP_ADD_A:
                    case OpCodes.STORE_MAP:
                    {
                        let key = DataStack.pop();
                        let value = DataStack.pop();
                        let map = DataStack.top();
                        if (map == null && DataStack.top(1) instanceof AST.ASTMap) {
                            map = DataStack.top(1);
                        }

                        if (curBlock.blockType == AST.ASTBlock.BlockType.For && curBlock.comprehension) {
                            DataStack.pop();
                            let node = new AST.ASTComprehension (value, key);
                            node.line = code.Current.LineNo;
                            node.kind = AST.ASTComprehension.DICT;
                            DataStack.push(node);
                        } else {
                            map.add(key, value);
                        }
                    }
                    break;
                    case OpCodes.BUILD_SLICE_A:
                    {
                        if (code.Current.Argument == 2) {
                            let end = DataStack.pop();
                            let start = DataStack.pop();

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
                            mapNode.line = code.Current.LineNo;
                            DataStack.push(mapNode);

                        } else if (code.Current.Argument == 3) {
                            let step = DataStack.pop();
                            let end = DataStack.pop();
                            let start = DataStack.pop();

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
                            lhs.line = code.Current.LineNo;
    
                            if (!step) {
                                sliceOp = AST.ASTSlice.SliceOp.Slice1;
                            } else {
                                sliceOp = AST.ASTSlice.SliceOp.Slice3;
                            }

                            let sliceNode = new AST.ASTSlice(sliceOp, start || new AST.ASTNone(), end || new AST.ASTNone());
                            sliceNode.line = code.Current.LineNo;
                            DataStack.push(sliceNode);
                        }
                    }
                    break;
                    case OpCodes.BUILD_STRING_A:
                    {
                        let values = [];
                        for (let idx = 0; idx < code.Current.Argument; idx++) {
                            values.push(DataStack.pop());
                        }

                        let stringNode = new AST.ASTJoinedStr(values);
                        stringNode.line = code.Current.LineNo;
                        DataStack.push(stringNode);
                    }
                    break;
                    case OpCodes.BUILD_TUPLE_A:
                    {
                        if (DataStack.top() instanceof AST.ASTLoadBuildClass) {
                            break;
                        }

                        let values = [];
                        for (let idx = code.Current.Argument - 1; idx >= 0; idx--) {
                            values[idx] = DataStack.pop();
                        }

                        let tupleNode = new AST.ASTTuple(values);
                        tupleNode.line = code.Current.LineNo;
                        DataStack.push(tupleNode);
                    }
                    break;
                    case OpCodes.KW_NAMES_A:
                    {

                        let astNode = new AST.ASTKwNamesMap();
                        let keys = code.Current.ConstantObject;
                        for (let idx = keys.length - 1; idx >= 0; idx--) {
                            astNode.add(keys[idx], DataStack.pop());
                        }

                        astNode.line = code.Current.LineNo;
                        DataStack.push(astNode);
                    }
                    break;
                    case OpCodes.CALL_A:
                    case OpCodes.CALL_FUNCTION_A:
                    case OpCodes.INSTRUMENTED_CALL_A:
                    {
                        let kwparams = (code.Current.Argument & 0xFF00) >> 8;
                        let pparams = (code.Current.Argument & 0xFF);
                        let kwparamList = [];
                        let pparamList = [];
                        let loadBuildClassFound = false;

                        for (let idx = DataStack.length - 1; idx >= 0; idx--) {
                            if (DataStack[idx] instanceof AST.ASTLoadBuildClass) {
                                loadBuildClassFound = true;
                                break;
                            }
                        }
        
                        if (loadBuildClassFound) {
                            let bases = [];
                            let TOS = DataStack.top();

                            while (TOS instanceof AST.ASTName || TOS instanceof AST.ASTBinary) {
                                bases.push(TOS);
                                DataStack.pop();
                                TOS = DataStack.top();
                            }

                            // qualified name is PycString at TOS
                            let name = DataStack.pop();
                            let functionNode = DataStack.pop();
                            let loadbuild = DataStack.pop();
                            if (loadbuild instanceof AST.ASTLoadBuildClass) {
                                let callNode = new AST.ASTCall(functionNode, pparamList, kwparamList);
                                callNode.line = code.Current.LineNo;
                                let classNode = new AST.ASTClass(call, new AST.ASTTuple(bases), name);
                                classNode.line = code.Current.LineNo;
                                DataStack.push(classNode);
                                break;
                            }
                        }
        
                        /*
                        KW_NAMES(i)
                            Stores a reference to co_consts[consti] into an internal variable for use by CALL.
                            co_consts[consti] must be a tuple of strings.
                            New in version 3.11.
                        */
                        if (obj.Reader.versionCompare(3, 11) >= 0) {
                            let kwparams_map = DataStack.top();
                            if (kwparams_map instanceof AST.ASTKwNamesMap) {
                                DataStack.pop();
                                for (let kwParam of kwparams_map.values) {
                                    kwparamList.unshift(kwParam);
                                    kwparams--;
                                }
                            }
                        }
                        else {
                            for (let idx = 0; idx < kwparams; idx++) {
                                let value = DataStack.pop();
                                let key = DataStack.pop();
                                kwparamList.unshift({key, value});
                            }
                        }
                        let skipCallNode = false;
                        for (let idx = 0; idx < pparams; idx++) {
                            let param = DataStack.pop();
                            if (param instanceof AST.ASTFunction) {
                                let fun_code = param.code;
                                let code_src = fun_code.object;
                                let function_name = code_src.Name;
                                if (function_name == "<lambda>") {
                                    pparamList.unshift(param);
                                } else if ( pparams == 1) {
                                    // Decorator used
                                    let decorator = DataStack.pop();
                                    param.add_decorator(decorator);
                                    // Decorating function and returning it back to data stack
                                    DataStack.push(param);
                                    skipCallNode = true;
                                    break;
                                }
                            } else {
                                pparamList.unshift(param);
                            }
                        }

                        if (skipCallNode) {
                            break;
                        }

                        let func = DataStack.pop();
                        if ([OpCodes.CALL_A, OpCodes.INSTRUMENTED_CALL_A].includes(code.Current.OpCodeID) && DataStack.length > 0 && DataStack.top() == null) {
                            DataStack.pop();
                        }
        
                        if ([OpCodes.GET_ITER, OpCodes.GET_AITER].includes(code.Prev.OpCodeID)) {
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
                            DataStack.push(ast);

                        } else {
                            let callNode = new AST.ASTCall( func, pparamList, kwparamList);
                            callNode.line = code.Current.LineNo;
                            DataStack.push(callNode);
                        }
                    }
                    break;
                    case OpCodes.CALL_FUNCTION_VAR_A:
                    {
                        let variable = DataStack.pop();
                        let kwparams = (code.Current.Argument & 0xFF00) >> 8;
                        let pparams = (code.Current.Argument & 0xFF);
                        let kwparamList = [];
                        let pparamList = [];
                        for (let idx = 0; idx < kwparams; idx++) {
                            let value = DataStack.pop();
                            let key = DataStack.pop();
                            kwparamList.unshift({key, value});
                        }
                        for (let idx = 0; idx < pparams; idx++) {
                            pparamList.unshift(DataStack.pop());
                        }
                        let func = DataStack.pop();
        
                        let callNode = new AST.ASTCall( func, pparamList, kwparamList);
                        callNode.var = variable;
                        callNode.line = code.Current.LineNo;
                        DataStack.push(callNode);
                    }
                    break;
                    case OpCodes.CALL_FUNCTION_KW_A:
                    {
                        let kw = DataStack.pop();
                        let kwparams = (code.Current.Argument & 0xFF00) >> 8;
                        let pparams = (code.Current.Argument & 0xFF);
                        let kwparamList = [];
                        let pparamList = [];
                        for (let idx = 0; idx < kwparams; idx++) {
                            let value = DataStack.pop();
                            let key = DataStack.pop();
                            kwparamList.unshift({key, value});
                        }
                        for (let idx = 0; idx < pparams; idx++) {
                            pparamList.unshift(DataStack.pop());
                        }
                        let func = DataStack.pop();
        
                        let callNode = new AST.ASTCall( func, pparamList, kwparamList);
                        callNode.kw = kw;
                        callNode.line = code.Current.LineNo;
                        DataStack.push(callNode);
                    }
                    break;
                    case OpCodes.CALL_FUNCTION_VAR_KW_A:
                    {
                        let kw = DataStack.pop();
                        let variable = DataStack.pop();
                        let kwparams = (code.Current.Argument & 0xFF00) >> 8;
                        let pparams = (code.Current.Argument & 0xFF);
                        let kwparamList = [];
                        let pparamList = [];
                        for (let idx = 0; idx < kwparams; idx++) {
                            let value = DataStack.pop();
                            let key = DataStack.pop();
                            kwparamList.unshift({key, value});
                        }
                        for (let idx = 0; idx < pparams; idx++) {
                            pparamList.unshift(DataStack.pop());
                        }
                        let func = DataStack.pop();
        
                        let callNode = new AST.ASTCall( func, pparamList, kwparamList);
                        callNode.kw = kw;
                        callNode.var = variable;
                        callNode.line = code.Current.LineNo;
                        DataStack.push(callNode);
                    }
                    break;
                    case OpCodes.CALL_METHOD_A:
                    {
                        let pparamList = [];
                        for (let idx = 0; idx < code.Current.Argument; idx++) {
                            let param = DataStack.pop();
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
                                    storeNode.line = code.Current.LineNo;
                                    curBlock.nodes.push(storeNode);
        
                                    pparamList.unshift(decorNameNode);
                                }
                            } else {
                                pparamList.unshift(param);
                            }
                        }
                        let func = DataStack.pop();
                        let callNode = new AST.ASTCall (func, pparamList, []);
                        callNode.line = code.Current.LineNo;
                        DataStack.push(callNode);
                    }
                    break;
                    case OpCodes.CONTINUE_LOOP_A:
                    {
                        let node = new AST.ASTKeyword (AST.ASTKeyword.Word.Continue);
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.COMPARE_OP_A:
                    {
                        let right = DataStack.pop();
                        let left = DataStack.pop();
                        let arg = code.Current.Argument;
                        if (obj.Reader.versionCompare(3, 12) >= 0) {
                            arg >>= 4;
                        }
                        let node = new AST.ASTCompare (left, right, arg);
                        node.line = code.Current.LineNo;
                        DataStack.push(node);
                    }
                    break;
                    case OpCodes.CONTAINS_OP_A:
                    {
                        let right = DataStack.pop();
                        let left = DataStack.pop();
                        // The code.Current.Argument will be 0 for 'in' and 1 for 'not in'.
                        let node = new AST.ASTCompare (left, right, code.Current.Argument ? AST.ASTCompare.CompareOp.NotIn : AST.ASTCompare.CompareOp.In);
                        node.line = code.Current.LineNo;
                        DataStack.push(node);

                    }
                    break;
                    case OpCodes.DELETE_ATTR_A:
                    {
                        let name = DataStack.pop();
                        let node = new AST.ASTDelete(new AST.ASTBinary(name, new AST.ASTName(code.Current.Name), AST.ASTBinary.BinOp.Attr));
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DELETE_GLOBAL_A:
                        obj.Globals.add(code.Current.Name);
                        /* Fall through */
                    case OpCodes.DELETE_NAME_A:
                    {
                        let varname = code.Current.Name;
        
                        if (varname.length >= 2 && varname.startsWith('_[')) {
                            /* Don't show deletes that are a result of list comps. */
                            break;
                        }
        
                        let node = new AST.ASTDelete(new AST.ASTName(varname));
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DELETE_FAST_A:
                    {
                        let nameNode = new AST.ASTName(code.Current.Name);
        
                        if (nameNode.name.startsWith('_[')) {
                            /* Don't show deletes that are a result of list comps. */
                            break;
                        }
        
                        let node = new AST.ASTDelete(nameNode);
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DELETE_SLICE_0:
                    {
                        let name = DataStack.pop();
                        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice0)));
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DELETE_SLICE_1:
                    {
                        let upper = DataStack.pop();
                        let name = DataStack.pop();
        
                        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, upper)));
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DELETE_SLICE_2:
                    {
                        let lower = DataStack.pop();
                        let name = DataStack.pop();
        
                        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, lower)));
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DELETE_SLICE_3:
                    {
                        let lower = DataStack.pop();
                        let upper = DataStack.pop();
                        let name = DataStack.pop();
        
                        let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, upper, lower)));
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DELETE_SUBSCR:
                    {
                        let key = DataStack.pop();
                        let name = DataStack.pop();
        
                        let node = new AST.ASTDelete(new AST.ASTSubscr(name, key));
                        node.line = code.Current.LineNo;
                        curBlock.nodes.push(node);
                    }
                    break;
                    case OpCodes.DUP_TOP:
                    {
                        if (DataStack.top() == null) {
                            DataStack.push(null);
                        } else if (code.Next?.OpCodeID == OpCodes.ROT_THREE) {
                            // double compare case
                            skipNextJump = true;
                            code.GoNext();
                        } else if (DataStack.top() instanceof AST.ASTChainStore) {
                            let chainstore = DataStack.pop();
                            DataStack.push(DataStack.top());
                            DataStack.push(chainstore);
                        } else {
                            DataStack.push(DataStack.top());
                            let node = new AST.ASTChainStore ([], DataStack.top());
                            DataStack.push(node);
                        }
                    }
                    break;
                    case OpCodes.DUP_TOP_TWO:
                    {
                        let first = DataStack.pop();
                        let second = DataStack.top();
        
                        DataStack.push(first);
                        DataStack.push(second);
                        DataStack.push(first);
                    }
                    break;
                    case OpCodes.DUP_TOPX_A:
                    {
                        let first = [];
                        let second = [];
        
                        for (let idx = 0; idx < code.Current.Argument; idx++) {
                            let node = DataStack.pop();
                            first.push(node);
                            second.push(node);
                        }
        
                        while (first.length) {
                            DataStack.push(first.pop());
                        }
        
                        while (second.length) {
                            DataStack.push(second.pop());
                        }
                    }
                    break;
                    case OpCodes.END_FINALLY:
                    {
                        let isFinally = false;
                        if (curBlock.blockType == AST.ASTBlock.BlockType.Finally) {
                            let final = curBlock;
                            blocks.pop();
        
                            curBlock = blocks.top();
                            curBlock.nodes.push(final);
                            isFinally = true;
                        } else if (curBlock.blockType == AST.ASTBlock.BlockType.Except) {
                            blocks.pop();
                            let prev = curBlock;
        
                            let isUninitAsyncFor = false;
                            if (blocks.top().blockType == AST.ASTBlock.BlockType.Container) {
                                let container = blocks.pop();
                                let asyncForBlock = blocks.top();
                                isUninitAsyncFor = asyncForBlock.blockType == AST.ASTBlock.BlockType.AsyncFor && !asyncForBlock.inited;
                                if (isUninitAsyncFor) {
                                    let tryBlock = container.nodes[0];
                                    if (!tryBlock.nodes.empty() && tryBlock.blockType == AST.ASTBlock.BlockType.Try) {
                                        let store = tryBlock.nodes[0];
                                        if (store) {
                                            asyncForBlock.index = store.dest;
                                        }
                                    }
                                    curBlock = blocks.top();

                                    if (!curBlock.inited) {
                                        console.error("Error when decompiling 'async for'.\n");
                                    }
                                } else {
                                    blocks.push(container);
                                }
                            }
        
                            if (!isUninitAsyncFor) {
                                if (!curBlock.empty()) {
                                    blocks.top().append(curBlock);
                                }
        
                                curBlock = blocks.top();
        
                                /* Turn it into an else statement. */
                                if (curBlock.end != code.Next?.Offset || curBlock.hasFinally) {
                                    let elseblk = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, code.Current.Offset, prev.end);
                                    elseblk.init();
                                    blocks.push(elseblk);
                                    curBlock = blocks.top();
                                }
                            }
                        }
        
                        if (curBlock.blockType == AST.ASTBlock.BlockType.Container) {
                            /* This marks the end of the except block(s). */
                            let cont = curBlock;
                            if (!cont.hasFinally || isFinally) {
                                /* If there's no finally block, pop the container. */
                                blocks.pop();
                                curBlock = blocks.top();
                                curBlock.append(cont);
                            }
                            if (cont. hasFinally) {

                            }
                        }
                    }
                    break;
                    case OpCodes.EXEC_STMT:
                    {
                        if (DataStack.top() instanceof AST.ASTChainStore) {
                            DataStack.pop();
                        }
                        let loc = DataStack.pop();
                        let glob = DataStack.pop();
                        let stmt = DataStack.pop();
                        let node = new AST.ASTExec(stmt, glob, loc);
                        node.line = code.Current.LineNo;
                        curBlock.append(node);
                    }
                    break;
                    case OpCodes.FOR_ITER_A:
                    case OpCodes.INSTRUMENTED_FOR_ITER_A:
                    {
                        let iter = DataStack.pop(); // Iterable
                        /* Pop it? Don't pop it? */
        
                        let start = code.Current.Offset;
                        let end = 0;
                        let line = code.Current.LineNo;
                        let comprehension = false;
        
                        // before 3.8, there is a SETUP_LOOP instruction with block start and end position,
                        //    the code.Current.Argument is usually a jump to a POP_BLOCK instruction
                        // after 3.8, block extent has to be inferred implicitly; the code.Current.Argument is a jump to a position after the for block
                        if (obj.Reader.versionCompare(3, 8) >= 0) {
                            end = code.Current.Argument;
                            if (obj.Reader.versionCompare(3, 10) >= 0)
                                end *= 2; // // BPO-27129
                            end += code.Next?.Offset;
                            [end] = code.FindEndOfBlock(end);
                            comprehension = code.Current.Name == "<listcomp>";
                        } else {
                            if ((DataStack.top() instanceof AST.ASTSet ||
                                DataStack.top() instanceof AST.ASTList ||
                                DataStack.top() instanceof AST.ASTMap)
                                && DataStack.top().values.length == 0) {
                                end = code.Current.JumpTarget;
                                comprehension = true;
                            } else {
                                let top = blocks.top();
                                start = top.start;
                                end = top.end; // block end position from SETUP_LOOP
                                line = top.line;

                                if (top.blockType == AST.ASTBlock.BlockType.While) {
                                    blocks.pop();
                                } else {
                                    comprehension = true;
                                }
                            }
                        }
        
                        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.For, start, end, iter);
                        forblk.line = line;
                        forblk.comprehension = comprehension;
                        blocks.push(forblk);
                        curBlock = blocks.top();
        
                        DataStack.push(null);
                    }
                    break;
                    case OpCodes.FOR_LOOP_A:
                    {
                        let curidx = DataStack.pop(); // Current index
                        let iter = DataStack.pop(); // Iterable
        
                        let comprehension = false;
                        let top = blocks.top();

                        if (top.blockType == AST.ASTBlock.BlockType.While) {
                            blocks.pop();
                        } else {
                            comprehension = true;
                        }
                        
                        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.For, code.Current.Offset, top.end, iter);
                        forblk.line = code.Current.LineNo;
                        forblk.comprehension = comprehension;
                        blocks.push(forblk);
                        curBlock = blocks.top();
        
                        /* Python Docs say:
                                "push the sequence, the incremented counter,
                                and the current item onto the DataStack." */
                        DataStack.push(iter);
                        DataStack.push(curidx);
                        DataStack.push(null); // We can totally hack this >_>
                    }
                    break;
                    case OpCodes.GET_AITER:
                    {
                        // Logic similar to FOR_ITER_A
                        let iter = DataStack.pop(); // Iterable
        
                        let top = blocks.top();
                        if (top.blockType == AST.ASTBlock.BlockType.While) {
                            blocks.pop();
                            let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.AsyncFor, top.start, top.end, iter);
                            forblk.line = code.Current.LineNo;
                            blocks.push(forblk);
                            curBlock = blocks.top();
                            DataStack.push(null);
                        } else {
                                console.error("Unsupported use of GET_AITER outside of SETUP_LOOP\n");
                        }
                    }
                    break;
                    case OpCodes.GET_ANEXT:
                        break;
                    case OpCodes.FORMAT_VALUE_A:
                    {
                        let conversion_flag = code.Current.Argument;
                        switch (conversion_flag) {
                            case AST.ASTFormattedValue.ConversionFlag.None:
                            case AST.ASTFormattedValue.ConversionFlag.Str:
                            case AST.ASTFormattedValue.ConversionFlag.Repr:
                            case AST.ASTFormattedValue.ConversionFlag.ASCII:
                            {
                                let val = DataStack.pop();
                                let node = new AST.ASTFormattedValue (val, conversion_flag, null);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);
                            }
                            break;
                            case AST.ASTFormattedValue.ConversionFlag.FmtSpec:
                            {
                                let format_spec = DataStack.pop();
                                let val = DataStack.pop();
                                let node = new AST.ASTFormattedValue (val, conversion_flag, format_spec);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);
                            }
                            break;
                            default:
                                console.error(`Unsupported FORMAT_VALUE_A conversion flag: ${code.Current.Argument}\n`);
                        }
                    }
                    break;
                    case OpCodes.GET_AWAITABLE:
                        {
                            let object = DataStack.pop();
                            let node = new AST.ASTAwaitable (object);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                    }
                        break;
                    case OpCodes.GET_ITER:
                    case OpCodes.GET_YIELD_FROM_ITER:
                        /* We just entirely ignore this */
                        if (code.Next.OpCodeID == OpCodes.CALL_FUNCTION_A) {
                            DataStack.push(new AST.ASTIteratorValue(DataStack.pop()));
                        }
                        break;
                    case OpCodes.IMPORT_NAME_A:
                        if (obj.Reader.versionCompare(2, 0) < 0) {
                            let node = new AST.ASTImport(new AST.ASTName(code.Current.Name), null);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        } else {
                            let fromlist = DataStack.pop();
                            if (fromlist instanceof AST.ASTNone) {
                                fromlist = null;
                            }
                            let dots = '';
                            if (obj.Reader.versionCompare(2, 5) >= 0) {
                                let importLevelNode = DataStack.pop();    // Level
                                let importLevel = +importLevelNode?.object || -1;
                                if (importLevel > 0) {
                                    dots = Buffer.alloc(importLevel, '.').toString('ascii');
                                }
                            }

                            let node = new AST.ASTImport (new AST.ASTName(dots + code.Current.Name), fromlist);
                            node.line = code.Current.LineNo;

                            if (code.Next?.OpCodeID == OpCodes.IMPORT_STAR) {
                                node.add_store(new AST.ASTStore(new AST.ASTName("*"), null));
                                code.GoNext();
                            } else if (fromlist?.object?.ClassName == 'Py_Tuple' && fromlist.object.Value.length > 0) {
                                code.extractImportNames(fromlist.object, (name, alias) => {
                                    node.add_store(new AST.ASTStore(new AST.ASTName(name), new AST.ASTName(alias)));
                                });
                            } else if (!fromlist) {
                                let aliasNode = code.GetOpCodeByName("STORE_*");
                                node.alias = new AST.ASTName(aliasNode.Label);
                                code.GoToOffset(aliasNode.Offset);
                            } else {
                                console.error('WARNING: Not covered situation in IMPORT_NAME.');
                            }

                            curBlock.nodes.push(node);

                        }
                        break;
                    // Handled in IMPORT_NAME_A
                    case OpCodes.IMPORT_FROM_A:
                    case OpCodes.IMPORT_STAR:
                    break;
                    case OpCodes.IS_OP_A:
                    {
                        let right = DataStack.pop();
                        let left = DataStack.pop();
                        // The code.Current.Argument will be 0 for 'is' and 1 for 'is not'.
                        let node = new AST.ASTCompare (left, right, code.Current.Argument ? AST.ASTCompare.CompareOp.IsNot : AST.ASTCompare.CompareOp.Is);
                        node.line = code.Current.LineNo;
                        curBlock.append(node);
                    }
                    break;
                    case OpCodes.JUMP_IF_FALSE_A:
                    case OpCodes.JUMP_IF_TRUE_A:
                    case OpCodes.JUMP_IF_FALSE_OR_POP_A:
                    case OpCodes.JUMP_IF_TRUE_OR_POP_A:
                    case OpCodes.POP_JUMP_IF_FALSE_A:
                    case OpCodes.POP_JUMP_IF_TRUE_A:
                    case OpCodes.POP_JUMP_FORWARD_IF_FALSE_A:
                    case OpCodes.POP_JUMP_FORWARD_IF_TRUE_A:
                    case OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A:
                    case OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A:
                    {
                        if (skipNextJump) {
                            skipNextJump = false;
                            if (code.Next.OpCodeID == OpCodes.POP_TOP) {
                                code.GoNext();
                            }
                            break;
                        }
                        let cond = DataStack.top();
                        let ifblk = null;
                        let popped = AST.ASTCondBlock.InitCondition.Uninited;
        
                        if ([
                                OpCodes.POP_JUMP_IF_FALSE_A,
                                OpCodes.POP_JUMP_IF_TRUE_A,
                                OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
                                OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
                                OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
                                OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A
                            ].includes(code.Current.OpCodeID)) {

                            /* Pop condition before the jump */
                            DataStack.pop();
                            popped = AST.ASTCondBlock.InitCondition.PrePopped;
                        } else if ([
                            OpCodes.JUMP_IF_FALSE_OR_POP_A,
                            OpCodes.JUMP_IF_TRUE_OR_POP_A,
                            OpCodes.JUMP_IF_FALSE_A,
                            OpCodes.JUMP_IF_TRUE_A
                        ].includes(code.Current.OpCodeID)) {
                            /* Pop condition only if condition is met */
                            DataStack.pop();
                            popped = AST.ASTCondBlock.InitCondition.Popped;
                        }
        
                        /* "Jump if true" means "Jump if not false" */
                        let neg =  [
                            OpCodes.JUMP_IF_TRUE_A, OpCodes.JUMP_IF_TRUE_OR_POP_A,
                            OpCodes.POP_JUMP_IF_TRUE_A, OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
                            OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A
                        ].includes(code.Current.OpCodeID);
        
                        let offs = code.Current.Argument;
                        if (obj.Reader.versionCompare(3, 10) >= 0)
                            offs *= 2; // // BPO-27129
                        if (obj.Reader.versionCompare(3, 12) >= 0
                            || [
                                OpCodes.JUMP_IF_FALSE_A, OpCodes.JUMP_IF_TRUE_A,
                                OpCodes.POP_JUMP_FORWARD_IF_TRUE_A, OpCodes.POP_JUMP_FORWARD_IF_FALSE_A
                            ].includes(code.Current.OpCodeID)) {
                            /* Offset is relative in these cases */
                            offs += code.Next?.Offset;
                        }

                        [offs] = code.FindEndOfBlock(offs);

                        if ([   OpCodes.JUMP_IF_FALSE_A,
                                OpCodes.JUMP_IF_TRUE_A
                            ].includes(code.Current.OpCodeID) &&
                            code.Next?.OpCodeID == OpCodes.POP_TOP
                        ) {
                            code.GoNext();
                        }
    
                        if (cond instanceof AST.ASTCompare
                                && cond.op == AST.ASTCompare.CompareOp.Exception) {
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Except
                                    && curBlock.condition == null) {
                                blocks.pop();
                                curBlock = blocks.top();
                            }
        
                            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, code.Current.Offset, offs, cond.right, false);
                        } else if (curBlock.blockType == AST.ASTBlock.BlockType.Else
                                    && curBlock.size == 0) {
                            /* Collapse into elif statement */
                            let startOffset = curBlock.start;
                            blocks.pop();
                            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Elif, startOffset, offs, cond, neg);
                        } else if (curBlock.size == 0 && !curBlock.inited
                                    && curBlock.blockType == AST.ASTBlock.BlockType.While
                                    && code.Current.LineNo == curBlock.line) {
                            /* The condition for a while loop */
                            let top = blocks.top();
                            top.condition = cond;
                            top.negative = neg;
                            if (popped) {
                                top.init(popped);
                            }
                        } else if (curBlock.size == 0 && curBlock.end <= offs
                                    && [ AST.ASTBlock.BlockType.If,
                                         AST.ASTBlock.BlockType.Elif,
                                         AST.ASTBlock.BlockType.While
                                        ].includes(curBlock.blockType)) {
                            let newcond;
                            let top = curBlock;
                            let cond1 = top.condition;
                            blocks.pop();
        
                            if (curBlock.end == offs
                                    || (curBlock.end == code.Next?.Offset && !top.negative)) {
                                /* if blah and blah */
                                newcond = new AST.ASTBinary(cond1, cond, AST.ASTBinary.BinOp.LogicalAnd);
                            } else {
                                /* if <condition 1> or <condition 2> */
                                newcond = new AST.ASTBinary(cond1, cond, AST.ASTBinary.BinOp.LogicalOr);
                            }
                            newcond.line = code.Current.LineNo;
                            ifblk = new AST.ASTCondBlock(top.blockType, top.start, offs, newcond, neg);
                        } else if (curBlock.blockType == AST.ASTBlock.BlockType.For
                                    && curBlock.comprehension
                                    && obj.Reader.versionCompare(2, 7) >= 0) {
                            /* Comprehension condition */
                            curBlock.condition = cond;
                            break;
                        } else {
                            /* Plain old if statement */
                            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.If, code.Current.Offset, offs, cond, neg);
                        }
        
                        if (ifblk) {
                            if (popped)
                                ifblk.init(popped);
            
                            blocks.push(ifblk);
                        }
                        curBlock = blocks.top();
                    }
                    break;
                    case OpCodes.JUMP_ABSOLUTE_A:
                        {
                            if (skipNextJump) {
                                skipNextJump = false;
                                break;
                            }

                            let offs = code.Current.Argument;
                            if (obj.Reader.versionCompare(3, 10) >= 0) {
                                offs *= 2; // 2 bytes size - BPO-27129
                            }
            
                            // [offs] = code.FindEndOfBlock(offs);

                            if (offs <= code.Next?.Offset) {
                                if (curBlock.blockType == AST.ASTBlock.BlockType.For) {
                                    let is_jump_to_start = offs == curBlock.start;
                                    let should_pop_for_block = curBlock.comprehension;
                                    // in v3.8, SETUP_LOOP is deprecated and for blocks aren't terminated by POP_BLOCK, so we add them here
                                    let should_add_for_block = obj.Reader.versionCompare(3, 8) >= 0 && is_jump_to_start && !curBlock.comprehension; // ||
                                                            //    obj.Reader.versionCompare(3, 8) < 0 && is_jump_to_start && curBlock.comprehension;
            
                                    if (should_pop_for_block || should_add_for_block) {
                                        let top = DataStack.top();
            
                                        if (top instanceof AST.ASTComprehension) {
                                            let comp = top;
            
                                            comp.addGenerator(curBlock);
                                        }
            
                                        let tmp = curBlock;
                                        blocks.pop();
                                        curBlock = blocks.top();
                                        if (should_add_for_block ||
                                            (curBlock === blocks[0] && curBlock.nodes.length == 0)) {
                                            curBlock.append(tmp);
                                        }
                                    }
                                } else if (curBlock.blockType == AST.ASTBlock.BlockType.Else) {
                                    blocks.pop();
                                    blocks.top().append(curBlock);
                                    curBlock = blocks.top();
            
                                    if (curBlock.blockType == AST.ASTBlock.BlockType.Container
                                            && !curBlock.hasFinally) {
                                        blocks.pop();
                                        blocks.top().append(curBlock);
                                        curBlock = blocks.top();
                                    }
                                } else {
                                    // First of all we have to figure out if there is any While or For blocks wer are in
                                    let loopBlock = null;
                                    for (let blockIdx = blocks.length - 1; blockIdx > 0; blockIdx--) {
                                        if ([AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.AsyncFor].includes(blocks[blockIdx].blockType)) {
                                            loopBlock = blocks[blockIdx];
                                            break;
                                        }
                                    }

                                    if (!loopBlock) {
                                        break;
                                    }

                                    if (curBlock.end == code.Next?.Offset) {
                                        break;
                                    }

                                    if ([OpCodes.JUMP_ABSOLUTE_A, OpCodes.JUMP_FORWARD_A].includes(code.Prev?.OpCodeID)) {
                                        break;
                                    }

                                    if (curBlock.nodes.top() instanceof AST.ASTKeyword) {
                                        break;
                                    }

                                    if ([AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif, AST.ASTBlock.BlockType.Else].includes(curBlock.blockType) && curBlock.nodes.length == 0) {
                                        curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
                                        break;
                                    }

                                    // Let's find actual end of block
                                    let blockEnd = loopBlock.end;
                                    let instr = code.PeekInstructionAtOffset(blockEnd);
                                    let currentIndex = instr.InstructionIndex;

                                    while (blockEnd > loopBlock.start) {
                                        if (instr.OpCodeID == OpCodes.JUMP_ABSOLUTE_A &&
                                            (instr.JumpTarget == loopBlock.start + 3 ||
                                             instr.JumpTarget < loopBlock.start)
                                        ) {
                                            currentIndex--;
                                            instr = code.PeekInstructionAt(currentIndex);
                                            blockEnd = instr.Offset;
                                        } else {
                                            break;
                                        }
                                    }

                                    if (code.Current.Offset < blockEnd) {
                                        curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
                                    }
                                }
            
                                /* We're in a loop, this jumps back to the start */
                                /* I think we'll just ignore this case... */
                                break; // Bad idea? Probably!
                            }
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Container) {
                                let cont = curBlock;
                                // EXPERIMENT
                                if (cont.hasExcept && code.Next?.Offset <= cont.except) {
                                    let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, code.Current.Offset, code.Current.JumpTarget, null, false);
                                    except.init();
                                    blocks.push(except);
                                    curBlock = blocks.top();
                                }
                                break;
                            }
            
                            let prev = curBlock;
            
                            if (blocks.length > 1) {
                                do {
                                    blocks.pop();
                                    blocks.top().append(prev);
                
                                    if ([
                                            AST.ASTBlock.BlockType.If,
                                            AST.ASTBlock.BlockType.Elif
                                        ].includes(prev.blockType)) {
                                        let top = blocks.top();
                                        let next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, code.Current.Offset, top.end);
                                        top.end = code.Current.Offset;
                                        if (prev.inited == AST.ASTCondBlock.InitCondition.PrePopped) {
                                            next.init(AST.ASTCondBlock.InitCondition.PrePopped);
                                        }
                
                                        blocks.push(next);
                                        prev = null;
                                    } else if (prev.blockType == AST.ASTBlock.BlockType.Except) {
                                        let top = blocks.top();
                                        let next = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, top.start, top.end, null, false);
                                        next.init();
                
                                        blocks.push(next);
                                        prev = null;
                                    } else if (prev.blockType == AST.ASTBlock.BlockType.Else) {
                                        /* Special case */
                                        if (blocks.top().blockType != AST.ASTBlock.BlockType.Main) {
                                            prev = blocks.top();
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
            
                            curBlock = blocks.top();
                        }
                        break;
                    case OpCodes.JUMP_FORWARD_A:
                    case OpCodes.INSTRUMENTED_JUMP_FORWARD_A:
                        {
                            if (skipNextJump) {
                                skipNextJump = false;
                                break;
                            }
    
                            let offs = code.Current.Argument;
                            if (obj.Reader.versionCompare(3, 10) >= 0)
                                offs *= 2; // 2 bytes per offset as per BPO-27129
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Container) {
                                let cont = curBlock;
                                if (cont.hasExcept) {
                                    curBlock.end = code.Next?.Offset + offs;
                                    let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, code.Current.Offset, curBlock.end, null, false);
                                    except.init();
                                    blocks.push(except);
                                    curBlock = blocks.top();
                                }
                                break;
                            }
            
                            let prev = curBlock;
            
                            if (blocks.length > 1) {
                                do {
                                    blocks.pop();
                
                                    if (!blocks.empty())
                                        blocks.top().append(prev);
                
                                    if (prev.blockType == AST.ASTBlock.BlockType.If
                                            || prev.blockType == AST.ASTBlock.BlockType.Elif) {
                                        if (offs < 3) {
                                            prev = null;
                                            continue;
                                        }
                                        let next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, code.Current.Offset, code.Next?.Offset + offs);
                                        if (prev.inited == AST.ASTCondBlock.InitCondition.PrePopped) {
                                            next.init(AST.ASTCondBlock.InitCondition.PrePopped);
                                        }
                
                                        blocks.push(next);
                                        prev = null;
                                    } else if (prev.blockType == AST.ASTBlock.BlockType.Except && offs > 2) {
                                        let next = null;

                                        if (code.Next?.OpCodeID == OpCodes.END_FINALLY) {
                                            next = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, code.Current.Offset, code.Current.JumpTarget);
                                            next.init();
                                        } else {
                                            next = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, code.Current.Offset, code.Next?.Offset + offs, null, false);
                                            next.init();
                                        }
                
                                        blocks.push(next);
                                        prev = null;
                                    } else if (prev.blockType == AST.ASTBlock.BlockType.Else) {
                                        /* Special case */
                                        prev = blocks.top();
                
                                        if (prev.blockType == AST.ASTBlock.BlockType.Main) {
                                            /* Something went out of the control! */
                                            prev = null;
                                        }
                                    } else if (prev.blockType == AST.ASTBlock.BlockType.Try
                                            && prev.end < code.Next?.Offset + offs) {
                                        DataStack.pop();
                
                                        if (blocks.top().blockType == AST.ASTBlock.BlockType.Container) {
                                            let cont = blocks.top();
                                            if (cont.hasExcept) {
                
                                                let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, prev.end, code.Next?.Offset + offs, null, false);
                                                except.init();
                                                blocks.push(except);
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
            
                            curBlock = blocks.top();
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Except) {
                                curBlock.end = code.Next?.Offset + offs;
                            }
                        }
                        break;
                        case OpCodes.LIST_APPEND:
                        case OpCodes.LIST_APPEND_A:
                        {
                            let value = DataStack.pop();
                            let list = DataStack.top();
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.For && curBlock.comprehension) {
                                DataStack.pop();
                                let node = new AST.ASTComprehension (value);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);
                            } else {
                                let node = new AST.ASTSubscr (list, value);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);
                            }
                        }
                        break;
                        case OpCodes.SET_UPDATE_A:
                        {
                            let rhs = DataStack.pop();
                            let lhs = DataStack.pop();
            
                            if (!(rhs instanceof AST.ASTObject)) {
                                fprintf(stderr, "Unsupported argument found for SET_UPDATE\n");
                                break;
                            }
            
                            // I've only ever seen this be a TYPE_FROZENSET, but let's be careful...
                            let obj = rhs.object;
                            if (obj?.ClassType != "Py_FrozenSet") {
                                console.error("Unsupported argument type found for SET_UPDATE\n");
                                break;
                            }
            
                            let result = lhs.values;
                            for (let value of obj.values) {
                                result.push(new AST.ASTObject (value));
                            }
            
                            let node = new AST.ASTSet (result);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.LIST_EXTEND_A:
                        {
                            let rhs = DataStack.pop();
                            let lhs = DataStack.pop();
            
                            if (!(rhs instanceof AST.ASTObject)) {
                                fprintf(stderr, "Unsupported argument found for LIST_EXTEND\n");
                                break;
                            }
            
                            // I've only ever seen this be a SMALL_TUPLE, but let's be careful...
                            let obj = rhs.object;
                            if (obj.ClassType != "Py_Tuple" && obj.ClassType != "Py_SmallTuple") {
                                console.error("Unsupported argument type found for LIST_EXTEND\n");
                                break;
                            }
            
                            let result = lhs.values;
                            for (let value of obj.values) {
                                result.push(new AST.ASTObject(value));
                            }
            
                            let node = new AST.ASTList (result);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.LOAD_ATTR_A:
                        {
                            let name = DataStack.top();
                            if (!(name instanceof AST.ASTImport)) {
                                DataStack.pop();
            
                                if (obj.Reader.versionCompare(3, 12) >= 0) {
                                    if (code.Current.Argument & 1) {
                                        /* Changed in version 3.12:
                                        If the low bit of namei is set, then a null or self is pushed to the stack
                                        before the attribute or unbound method respectively. */
                                        DataStack.push(null);
                                    }
                                    code.Current.Argument >>= 1;
                                }
            
                                let node = new AST.ASTBinary(name, new AST.ASTName(code.Current.Name), AST.ASTBinary.BinOp.Attr);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);
                            }
                        }
                        break;
                        case OpCodes.LOAD_BUILD_CLASS:
                        {
                            let node = new AST.ASTLoadBuildClass (new PycObject());
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.LOAD_CLOSURE_A:
                            /* Ignore this */
                            break;
                        case OpCodes.LOAD_CONST_A:
                        {
                            let constantObject = new AST.ASTObject(code.Current.ConstantObject);
                            constantObject.line = code.Current.LineNo;
            
                            if ((constantObject.object.ClassName == "Py_Tuple" ||
                                    constantObject.object.ClassName == "Py_SmallTuple") &&
                                    constantObject.object.Value.empty()) {
                                let node = new AST.ASTTuple ([]);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);
                            } else if (constantObject.object == null || constantObject.object.ClassName == "Py_None") {
                                DataStack.push(new AST.ASTNone());
                            } else {
                                DataStack.push(constantObject);
                            }
                        }
                        break;
                        case OpCodes.LOAD_DEREF_A:
                        case OpCodes.LOAD_CLASSDEREF_A:
                        {
                            let varName = code.Current.FreeName;
                            if (varName.length >= 2 && varName.startsWith('_[')) {
                                break;
                            }
                            let node = new AST.ASTName (varName);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.LOAD_FAST_A:
                        {
                            let varName = code.Current.Name;
                            if (varName.length >= 2 && varName.startsWith('_[')) {
                                break;
                            }

                            let node = new AST.ASTName (varName);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.LOAD_GLOBAL_A:
                        {
                            let varName = code.Current.Name;
                            if (varName.length >= 2 && varName.startsWith('_[')) {
                                break;
                            }

                            if (obj.Reader.versionCompare(3, 11) >= 0) {
                                // Loads the global named co_names[namei>>1] onto the DataStack.
                                if (code.Current.Argument & 1) {
                                    /* Changed in version 3.11: 
                                    If the low bit of "NAMEI" (code.Current.Argument) is set, 
                                    then a null is pushed to the stack before the global variable. */
                                    DataStack.push(null);
                                }
                                code.Current.Argument >>= 1;
                            }
                            let node = new AST.ASTName (varName);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.LOAD_LOCALS:
                        {
                            let node = new AST.ASTLocals ();
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.STORE_LOCALS:
                        {
                            DataStack.pop();
                        }
                        break;
                        case OpCodes.LOAD_METHOD_A:
                        {
                            // Behave like LOAD_ATTR
                            let name = DataStack.pop();
                            let node = new AST.ASTBinary (name, new AST.ASTName(code.Current.Name), AST.ASTBinary.BinOp.Attr);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.LOAD_NAME_A:
                        {
                            let varName = code.Current.Name;
                            if (varName.length >= 2 && varName.startsWith('_[')) {
                                break;
                            }
                            let node = new AST.ASTName (varName);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.MAKE_CLOSURE_A:
                        case OpCodes.MAKE_FUNCTION_A:
                        {
                            let func_code = DataStack.pop();
            
                            /* Test for the qualified name of the function (at TOS) */
                            let tos_type = func_code.object.ClassName;
                            if (!["Py_CodeObject", "Py_CodeObject2"].includes(tos_type)) {
                                func_code = DataStack.pop();
                            }
                            func_code.object.SourceCode = PycDecompiler.Decompile(func_code.object);
            
                            let defArgs = [], kwDefArgs = [], annotations = [];
                            let defCount = code.Current.Argument & 0xFF;
                            let kwDefCount = (code.Current.Argument >> 8) & 0xFF;
                            let numAnnotations = (code.Current.Argument >> 16) & 0xFF;
                            
                            if (obj.Reader.versionCompare(3, 0) < 0) {
                                for (let idx = 0; idx < defCount; ++idx) {
                                    defArgs.unshift(DataStack.pop());
                                }
                                
                                if (kwDefCount > 0) {
                                    for (let idx = 0; idx < kwDefCount - defCount; ++idx) {
                                        kwDefArgs.unshift(DataStack.pop());
                                    }
                                }
                            } else {
                                if (numAnnotations > 0) {
                                    let tuple = DataStack.pop();
                                    while (--numAnnotations > 0) {
                                        annotations.push({key: tuple[numAnnotations], value: DataStack.pop()})
                                    }
                                }

                                if (defCount > 0) {
                                    while (defCount-- > 0) {
                                        defArgs.unshift(DataStack.pop());
                                    }
                                }

                                if (kwDefCount > 0) {
                                    while (kwDefCount-- > 0) {
                                        let value = DataStack.pop();
                                        let name = DataStack.pop();
                                        kwDefArgs.unshift({name, value});
                                    }
                                }
                            }

                            let node = new AST.ASTFunction (func_code, defArgs, kwDefArgs, annotations);
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.NOP:
                            break;
                        case OpCodes.POP_BLOCK:
                        {
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Container ||
                                    curBlock.blockType == AST.ASTBlock.BlockType.Finally) {
                                /* These should only be popped by an END_FINALLY */
                                if (code.Prev?.OpCodeID == OpCodes.END_FINALLY && curBlock.blockType == AST.ASTBlock.BlockType.Container && curBlock.finally == code.Next.Offset + 3) {
                                    let finallyBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Finally, curBlock.finally, 0, true);
                                    blocks.push(finallyBlock);
                                    curBlock = blocks.top();
                                    code.GoNext();
                                }
                                break;
                            }
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.With) {
                                // This should only be popped by a WITH_CLEANUP
                                break;
                            }
            
                            if (curBlock.nodes.length &&
                                    curBlock.nodes.top() instanceof AST.ASTKeyword) {
                                curBlock.removeLast();
                            }
            
                            let tmp = blocks.pop();
            
                            if (!blocks.empty()) {
                                curBlock = blocks.top();
                            }
            
                            if (!blocks.empty() && !(tmp.blockType == AST.ASTBlock.BlockType.Else && tmp.nodes.empty())) {
                                curBlock.append(tmp);
                            }
            
                            if ([AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.While].includes(tmp.blockType) && tmp.end >= code.Next?.Offset) {
                                let blkElse = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, code.Current.Offset, tmp.end);
                                blocks.push(blkElse);
                                curBlock = blocks.top();
                            }
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Try
                                && tmp.blockType != AST.ASTBlock.BlockType.For
                                && tmp.blockType != AST.ASTBlock.BlockType.AsyncFor
                                && tmp.blockType != AST.ASTBlock.BlockType.While) {
                                tmp = curBlock;
                                blocks.pop();
                                curBlock = blocks.top();
            
                                if (!(tmp.blockType == AST.ASTBlock.BlockType.Else
                                        && tmp.nodes.empty())) {
                                    curBlock.append(tmp);
                                }
                            }
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Container) {            
                                if (tmp.blockType == AST.ASTBlock.BlockType.Else && !curBlock.hasFinally) {
            
                                    /* Pop the container */
                                    let cont = curBlock;
                                    blocks.pop();
                                    curBlock = blocks.top();
                                    curBlock.append(cont);
            
                                } else if (
                                    (tmp.blockType == AST.ASTBlock.BlockType.Else && curBlock.hasFinally) ||
                                    (tmp.blockType == AST.ASTBlock.BlockType.Try && !curBlock.hasExcept)
                                ) {
            
                                    let final = new AST.ASTBlock(AST.ASTBlock.BlockType.Finally, tmp.start, tmp.end, true);
                                    blocks.push(final);
                                    curBlock = blocks.top();
                                }
                            }
            
                            if ((curBlock.blockType == AST.ASTBlock.BlockType.For ||
                                    curBlock.blockType == AST.ASTBlock.BlockType.AsyncFor)
                                && curBlock.end == code.Next?.Offset) {
                                blocks.pop();
                                blocks.top().append(curBlock);
                                curBlock = blocks.top();
                            }

                            if (blocks.empty() && tmp.blockType == AST.ASTBlock.BlockType.Main) {
                                blocks.push(tmp);
                                curBlock = blocks.top();
                            }
                        }
                        break;
                        case OpCodes.POP_EXCEPT:
                            /* Do nothing. */
                        break;
                        case OpCodes.POP_TOP:
                        {
                            if (!(DataStack.top() instanceof AST.ASTComprehension) && [OpCodes.JUMP_ABSOLUTE_A, OpCodes.JUMP_FORWARD_A, OpCodes.POP_JUMP_IF_FALSE_A, OpCodes.JUMP_IF_FALSE_A].includes(code.Prev?.OpCodeID)) {
                                if (curBlock.blockType == AST.ASTBlock.BlockType.Except) {
                                    // Skipping POP_TOP, POP_TOP, POP_TOP
                                    if ([OpCodes.JUMP_ABSOLUTE_A, OpCodes.JUMP_FORWARD_A].includes(code.Prev.OpCodeID)) {
                                        if (code.Next?.OpCodeID == OpCodes.POP_TOP && code.Next?.Next?.OpCodeID == OpCodes.POP_TOP) {
                                            code.GoNext(2);
                                        }
                                    } else if (code.Prev.OpCodeID == OpCodes.POP_JUMP_IF_FALSE_A) {
                                        if ([OpCodes.STORE_NAME_A, OpCodes.STORE_FAST_A].includes(code.Next?.OpCodeID) && code.Next?.Next?.OpCodeID == OpCodes.POP_TOP) {
                                            let exceptionTypeNode = curBlock.condition;
                                            if (!(exceptionTypeNode instanceof AST.ASTName)) {
                                                console.error(`Expected ASTName, but got ${exceptionTypeNode.constructor.name}`);
                                                break;
                                            }
                                            let exceptionName = new AST.ASTName(code.Next.Name);
                                            exceptionName.line = code.Current.LineNo;
                                            curBlock.condition = new AST.ASTStore(exceptionTypeNode, exceptionName);
                                            code.GoNext(2);
                                        }
                                    } else if (code.Prev.OpCodeID == OpCodes.JUMP_IF_FALSE_A) {
                                        if ( code.Next?.OpCodeID == OpCodes.POP_TOP && [OpCodes.STORE_NAME_A, OpCodes.STORE_FAST_A].includes(code.Next?.Next?.OpCodeID) && code.Next?.Next?.Next?.OpCodeID == OpCodes.POP_TOP) {
                                            let exceptionTypeNode = curBlock.condition;
                                            if (!(exceptionTypeNode instanceof AST.ASTName)) {
                                                console.error(`Expected ASTName, but got ${exceptionTypeNode.constructor.name}`);
                                                break;
                                            }
                                            let exceptionName = new AST.ASTName(code.Next.Next.Name);
                                            exceptionName.line = code.Current.LineNo;
                                            curBlock.condition = new AST.ASTStore(exceptionTypeNode, exceptionName);
                                            code.GoNext(2);
                                        }
                                    }
                                }
                                break;
                            } else if ([OpCodes.PRINT_ITEM_TO].includes(code.Prev.OpCodeID) && curBlock.nodes.top() instanceof AST.ASTPrint) {
                                let printNode = curBlock.nodes.top();
                                if (printNode.stream && printNode.stream == DataStack.top()) {
                                    DataStack.pop();
                                    break;
                                }
                            }
                            let value = DataStack.pop();
                            if (!curBlock.inited) {
                                if (curBlock.blockType == AST.ASTBlock.BlockType.With) {
                                    curBlock.expr = value;
                                } else if (curBlock.blockType == AST.ASTBlock.BlockType.If && !curBlock.condition) {
                                    curBlock.condition = value;
                                }
                                curBlock.init();
                            } else if (value == null || value.processed) {
                                break;
                            }
            
                            if (!(value instanceof AST.ASTObject)) {
                                curBlock.append(value);
                            }
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.For
                                    && curBlock.comprehension) {
                                /* This relies on some really uncertain logic...
                                    * If it's a comprehension, the only POP_TOP should be
                                    * a call to append the iter to the list.
                                    */
                                if (value instanceof AST.ASTCall) {
                                    let pparams = value.pparams;
                                    if (!pparams.empty()) {
                                        let res = pparams[0];
                                        let node = new AST.ASTComprehension (res);
                                        node.line = code.Current.LineNo;
                                        DataStack.push(node);
                                    }
                                }
                            }
                        }
                        break;               
                        case OpCodes.PRINT_EXPR:
                        case OpCodes.PRINT_ITEM:
                        {
                            let printNode;
                            if (curBlock.nodes.length > 0 && curBlock.nodes.top() instanceof AST.ASTPrint) {
                                printNode = curBlock.nodes.top();
                            }
                            if (printNode && printNode.stream == null && !printNode.eol) {
                                printNode.add(DataStack.pop());
                            } else {
                                let node = new AST.ASTPrint(DataStack.pop());
                                node.line = code.Current.LineNo;
                                curBlock.append(node);
                            }
                        }
                        break;
                        case OpCodes.PRINT_ITEM_TO:
                        {
                            let stream = DataStack.pop();
                            let printNode;

                            if (curBlock.nodes.length > 0 && curBlock.nodes.top() instanceof AST.ASTPrint) {
                                printNode = curBlock.nodes.top();
                            }

                            if (printNode && printNode.stream == stream && !printNode.eol) {
                                printNode.add(DataStack.pop());
                            } else {
                                let node = new AST.ASTPrint(DataStack.pop(), stream);
                                node.line = code.Current.LineNo;
                                curBlock.append(node);
                            }
                        }
                        break;
                        case OpCodes.PRINT_NEWLINE:
                        {
                            let printNode;
                            if (!curBlock.empty() && curBlock.nodes.top() instanceof AST.ASTPrint)
                                printNode = curBlock.nodes.top();
                            if (printNode && printNode.stream == null && !printNode.eol)
                                printNode.eol = true;
                            else {
                                let node = new AST.ASTPrint();
                                node.line = code.Current.LineNo;
                                curBlock.append(node);
                            }
                            DataStack.pop();
                        }
                        break;
                        case OpCodes.PRINT_NEWLINE_TO:
                        {
                            let stream = DataStack.pop();
            
                            let printNode;
                            if (!curBlock.empty() && curBlock.nodes.top() instanceof AST.ASTPrint) {
                                printNode = curBlock.nodes.top();
                            }

                            if (printNode && printNode.stream == stream && !printNode.eol) {
                                printNode.eol = true;
                            } else {
                                let node = new AST.ASTPrint(null, stream);
                                node.line = code.Current.LineNo;
                                curBlock.append(node);
                            }
                            DataStack.pop();
                        }
                        break;
                        case OpCodes.RAISE_VARARGS_A:
                        {
                            let paramList = [];
                            for (let idx = 0; idx < code.Current.Argument; idx++) {
                                paramList.unshift(DataStack.pop());
                            }
                            let node = new AST.ASTRaise(paramList);
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
            
                            if ((curBlock.blockType == AST.ASTBlock.BlockType.If
                                    || curBlock.blockType == AST.ASTBlock.BlockType.Else)
                                    && (obj.Reader.versionCompare(2, 6) >= 0)) {            
                                let prev = curBlock;
                                blocks.pop();
                                curBlock = blocks.top();
                                curBlock.append(prev);
            
                                code.GoNext();
                            }
                        }
                        break;
                        case OpCodes.RETURN_VALUE:
                        case OpCodes.INSTRUMENTED_RETURN_VALUE_A:
                        {
                            let value = DataStack.pop();
                            if (value == null) {
                                value = new AST.ASTNone();
                            }
                            let node = new AST.ASTReturn(value);
                            node.inLambda = obj.Name == '<lambda>';
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
            
                            if ((curBlock.blockType == AST.ASTBlock.BlockType.If
                                    || curBlock.blockType == AST.ASTBlock.BlockType.Else)
                                    && (obj.Reader.versionCompare(2, 6) >= 0)) {
                                let prev = curBlock;
                                blocks.pop();
                                curBlock = blocks.top();
                                curBlock.append(prev);
            
                                if ([OpCodes.JUMP_ABSOLUTE_A, OpCodes.JUMP_FORWARD_A].includes(code.Next?.OpCodeID)) {
                                    code.GoNext();
                                }
                            }
                        }
                        break;
                        case OpCodes.RETURN_CONST_A:
                        case OpCodes.INSTRUMENTED_RETURN_CONST_A:
                        {
                            let value = new AST.ASTObject(code.Current.ConstantObject);
                            let node = new AST.ASTReturn(value);
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
                        }
                        break;
                        case OpCodes.ROT_TWO:
                        {
                            let one = DataStack.pop();
                            if (DataStack.top() instanceof AST.ASTChainStore) {
                                DataStack.pop();
                            }
                            let two = DataStack.pop();
            
                            DataStack.push(one);
                            DataStack.push(two);
                        }
                        break;
                        case OpCodes.ROT_THREE:
                        {
                            let one = DataStack.pop();
                            let two = DataStack.pop();
                            if (DataStack.top() instanceof AST.ASTChainStore) {
                                DataStack.pop();
                            }
                            let three = DataStack.pop();
                            DataStack.push(one);
                            DataStack.push(three);
                            DataStack.push(two);
                        }
                        break;
                        case OpCodes.ROT_FOUR:
                        {
                            let one = DataStack.pop();
                            let two = DataStack.pop();
                            let three = DataStack.pop();
                            if (DataStack.top() instanceof AST.ASTChainStore) {
                                DataStack.pop();
                            }
                            let four = DataStack.pop();
                            DataStack.push(one);
                            DataStack.push(four);
                            DataStack.push(three);
                            DataStack.push(two);
                        }
                        break;
                        case OpCodes.SET_LINENO_A:
                            // Ignore
                            break;
                        case OpCodes.SETUP_WITH_A:
                        {
                            let withBlock = new AST.ASTWithBlock(code.Current.Offset, code.Current.JumpTarget);
                            blocks.push(withBlock);
                            curBlock = blocks.top();
                        }
                        break;
                        case OpCodes.WITH_CLEANUP:
                        case OpCodes.WITH_CLEANUP_START:
                        {
                            // Stack top should be a None. Ignore it.
                            let none = DataStack.pop();
            
                            if (!(none instanceof AST.ASTNone)) {
                                console.error("Something TERRIBLE happened!\n");
                                break;
                            }
            
                            if (curBlock.blockType == AST.ASTBlock.BlockType.With
                                    && curBlock.end == code.Current.Offset) {
                                let withBlock = curBlock;
                                curBlock = blocks.pop();
                                curBlock.append(withBlock);
                            }
                            else {
                                console.error(`Something TERRIBLE happened! No matching with block found for WITH_CLEANUP at ${code.Current.Offset}\n`);
                            }
                        }
                        break;
                        case OpCodes.WITH_CLEANUP_FINISH:
                            /* Ignore this */
                            break;
                        case OpCodes.SETUP_EXCEPT_A:
                        {
                            if (curBlock.blockType == AST.ASTBlock.BlockType.Container && curBlock.line > -1 && curBlock.line == code.Current.LineNo) {
                                curBlock.except = code.Current.JumpTarget;
                            } else if (code.Prev?.OpCodeID == OpCodes.SETUP_FINALLY_A && code.Prev.LineNo > -1 && code.Prev.LineNo != code.Current.LineNo) {
                                let nextBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, code.Prev.Offset, code.Prev.JumpTarget, true);
                                blocks.push(nextBlock);
                                nextBlock = new AST.ASTContainerBlock(code.Current.Offset, 0, code.Current.JumpTarget);
                                blocks.push(nextBlock);
                            } else {
                                let nextBlock = new AST.ASTContainerBlock(code.Current.Offset, 0, code.Current.JumpTarget);
                                blocks.push(nextBlock);
                            }
            
                            let tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, code.Current.Offset, code.Current.JumpTarget, true);
                            blocks.push(tryBlock);
                            curBlock = blocks.top();
            
                            need_try = false;
                        }
                        break;
                        case OpCodes.SETUP_FINALLY_A:
                        {
                            let nextBlock = new AST.ASTContainerBlock(code.Current.Offset, code.Current.JumpTarget);
                            nextBlock.line = code.Current.LineNo;
                            blocks.push(nextBlock);
                            curBlock = blocks.top();
            
                            need_try = true;
                        }
                        break;
                        case OpCodes.SETUP_LOOP_A:
                        {
                            let nextBlock = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, code.Current.Offset, code.Current.JumpTarget, null, false);
                            nextBlock.line = code.Current.LineNo;
                            blocks.push(nextBlock);
                            curBlock = blocks.top();
                        }
                        break;
                        case OpCodes.SLICE_0:
                        {
                            let name = DataStack.pop();
                            if (name instanceof AST.ASTChainStore) {
                                name = name.source;
                            }
            
                            let sliceNode = new AST.ASTSlice (AST.ASTSlice.SliceOp.Slice0);
                            let node = new AST.ASTSubscr (name, sliceNode);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.SLICE_1:
                        {
                            let lower = DataStack.pop();
                            let name = DataStack.pop();
            
                            let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, lower);
                            let node = new AST.ASTSubscr(name, sliceNode);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.SLICE_2:
                        {
                            let upper = DataStack.pop();
                            let name = DataStack.pop();
            
                            let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, null, upper);
                            let node = new AST.ASTSubscr(name, sliceNode);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);    
                        }
                        break;
                        case OpCodes.SLICE_3:
                        {
                            let upper = DataStack.pop();
                            let lower = DataStack.pop();
                            let name = DataStack.pop();
            
                            let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, lower, upper);
                            let node = new AST.ASTSubscr(name, sliceNode);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);    
                        }
                        break;
                        case OpCodes.STORE_ATTR_A:
                        {
                            if (unpack) {
                                let name = DataStack.pop();
                                let attrNode = new AST.ASTBinary(name, new AST.ASTName(code.Current.Name), AST.ASTBinary.BinOp.Attr);
            
                                let tup = DataStack.top();
                                if (tup instanceof AST.ASTTuple) {
                                    tup.add(attrNode);
                                } else {
                                    console.error("Something TERRIBLE happened!\n");
                                }
            
                                if (--unpack <= 0) {
                                    DataStack.pop();
                                    let seqNode = DataStack.pop();
                                    if (seqNode instanceof AST.ASTChainStore) {
                                        seqNode.line = code.Current.LineNo;
                                        PycDecompiler.append_to_chain_store(seqNode, tup, DataStack, curBlock);
                                    } else {
                                        let node = new AST.ASTStore(seqNode, tup);
                                        node.line = code.Current.LineNo;
                                        curBlock.append(node);
                                    }
                                }
                            } else {
                                let name = DataStack.pop();
                                let value = DataStack.pop();
                                let attrNode = new AST.ASTBinary(name, new AST.ASTName(code.Current.Name), AST.ASTBinary.BinOp.Attr);
                                if (value instanceof AST.ASTChainStore) {
                                    PycDecompiler.append_to_chain_store(value, attrNode, DataStack, curBlock);
                                } else {
                                    let node = new AST.ASTStore(value, attrNode);
                                    node.line = code.Current.LineNo;
                                    curBlock.append(node);
                                }
                            }
                        }
                        break;
                        case OpCodes.STORE_DEREF_A:
                        {
                            if (unpack) {
                                let nameNode = new AST.ASTName(code.Current.FreeName);
                                let tupleNode = DataStack.top();
                                if (tupleNode instanceof AST.ASTTuple)
                                    tupleNode.add(nameNode);
                                else
                                    console.error("Something TERRIBLE happened!\n");
            
                                if (--unpack <= 0) {
                                    DataStack.pop();
                                    let seqNode = DataStack.pop();
            
                                    if (seqNode instanceof AST.ASTChainStore) {
                                        seqNode.line = code.Current.LineNo;
                                        PycDecompiler.append_to_chain_store(seqNode, tupleNode, DataStack, curBlock);
                                    } else {
                                        let node = new AST.ASTStore(seqNode, tupleNode);
                                        node.line = code.Current.LineNo;
                                        curBlock.append(node);
                                    }
                                }
                            } else {
                                let valueNode = DataStack.pop();
                                let nameNode = new AST.ASTName(code.Current.FreeName);
            
                                if (valueNode instanceof AST.ASTChainStore) {
                                    PycDecompiler.append_to_chain_store(valueNode, nameNode, DataStack, curBlock);
                                } else {
                                    let node = new AST.ASTStore(valueNode, nameNode);
                                    node.line = code.Current.LineNo;
                                    curBlock.append(node);
                                }
                            }
                        }
                        break;
                        case OpCodes.STORE_FAST_A:
                        case OpCodes.STORE_GLOBAL_A:
                        case OpCodes.STORE_NAME_A:
                        {
                            if (unpack) {
                                let nameNode = new AST.ASTName(code.Current.Name);
            
                                let tupleNode = DataStack.top();
                                if (tupleNode instanceof AST.ASTTuple) {
                                    if (starPos-- == 0) {
                                        nameNode.name = '*' + nameNode.name;
                                    }
                                    tupleNode.add(nameNode);
                                } else {
                                    console.error("Something TERRIBLE happened!\n");
                                }
                                
                                if (--unpack <= 0) {
                                    DataStack.pop();
                                    let seqNode = DataStack.pop();
            
                                    if (curBlock.blockType == AST.ASTBlock.BlockType.For
                                            && !curBlock.inited) {
                                        let tuple = tupleNode;
                                        if (tuple != null) {
                                            tuple.requireParens = false;
                                        }
                                        curBlock.index = tupleNode;
                                    } else if (seqNode instanceof AST.ASTChainStore) {
                                        seqNode.line = code.Current.LineNo;
                                        PycDecompiler.append_to_chain_store(seqNode, tupleNode, DataStack, curBlock);
                                    } else {
                                        let node = new AST.ASTStore(seqNode, tupleNode);
                                        node.line = code.Current.LineNo;
                                        curBlock.append(node);
                                    }
                                }
                            } else {
                                let varName = code.Current.Name;
                                if (varName.length >= 2 && varName.startsWith('_[')) {
                                    /* Don't show stores of list comp append objects. */
                                    break;
                                }
            
                                // Return private names back to their original name
                                let class_prefix = "_" + code.Current.Name;
                                if (varName.startsWith(class_prefix + "__")) {
                                    varName.value = varName.substring(class_prefix.length);
                                }
            
                                let nameNode = new AST.ASTName(varName);
                                nameNode.line = code.Current.LineNo;
            
                                if (curBlock.blockType == AST.ASTBlock.BlockType.For
                                        && !curBlock.inited) {
                                    curBlock.index = nameNode;
                                    curBlock.init();
                                } else if (DataStack.top() instanceof AST.ASTImport) {
                                    let valueNode = DataStack.pop();
                                    let importNode = DataStack.top();
                                    let storeNode = new AST.ASTStore(valueNode, nameNode);
                                    storeNode.line = code.Current.LineNo;
                                    importNode.add_store(storeNode);
                                } else if (curBlock.blockType == AST.ASTBlock.BlockType.With
                                            && !curBlock.inited) {
                                    let valueNode = DataStack.pop();
                                    curBlock.expr = valueNode;
                                    curBlock.var = nameNode;
                                    curBlock.init();
                                } else if (DataStack.top() instanceof AST.ASTChainStore) {
                                    let valueNode = DataStack.pop();
                                    PycDecompiler.append_to_chain_store(valueNode, nameNode, DataStack, curBlock);
                                    if (code.Prev.OpCodeID != OpCodes.DUP_TOP) {
                                        curBlock.append(valueNode);
                                    }
                                } else {
                                    let valueNode = DataStack.pop();
                                    if (valueNode instanceof AST.ASTFunction && !valueNode.code.object.SourceCode) {
                                        valueNode.code.object.SourceCode = PycDecompiler.Decompile(valueNode.code.object);
                                    }
                                    let node = new AST.ASTStore(valueNode, nameNode);
                                    node.line = code.Current.LineNo;
                                    curBlock.append(node);
                                }

                                if (code.Current.OpCodeID == OpCodes.STORE_GLOBAL_A) {
                                    obj.Globals.add(nameNode.name);
                                }
                            }
                        }
                        break;
                        case OpCodes.STORE_SLICE_0:
                        {
                            let destNode = DataStack.pop();
                            let valueNode = DataStack.pop();
                            let node = new AST.ASTStore(valueNode,
                                            new AST.ASTSubscr(destNode,
                                                new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice0)
                                            )
                                        );
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
                        }
                        break;
                        case OpCodes.STORE_SLICE_1:
                        {
                            let upper = DataStack.pop();
                            let dest = DataStack.pop();
                            let value = DataStack.pop();
                            let node = new AST.ASTStore(value,
                                new AST.ASTSubscr(dest,
                                    new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, upper)
                                )
                            );
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
                        }
                        break;
                        case OpCodes.STORE_SLICE_2:
                        {
                            let lowerNode = DataStack.pop();
                            let destNode = DataStack.pop();
                            let valueNode = DataStack.pop();
                            let node = new AST.ASTStore(valueNode,
                                new AST.ASTSubscr(destNode,
                                    new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, null, lowerNode)));
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
                        }
                        break;
                        case OpCodes.STORE_SLICE_3:
                        {
                            let lowerNode = DataStack.pop();
                            let upperNode = DataStack.pop();
                            let destNode = DataStack.pop();
                            let valueNode = DataStack.pop();
                            let node = new AST.ASTStore(valueNode,
                                new AST.ASTSubscr(destNode,
                                    new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, upperNode, lowerNode)));
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
                        }
                        break;
                        case OpCodes.STORE_SUBSCR:
                        {
                            if (unpack) {
                                let subscrNode = DataStack.pop();
                                let destNode = DataStack.pop();
            
                                let saveNode = new AST.ASTSubscr(destNode, subscrNode);
            
                                let tupleNode = DataStack.top();
                                if (tupleNode instanceof AST.ASTTuple)
                                    tupleNode.add(saveNode);
                                else
                                    console.error("Something TERRIBLE happened!\n");
            
                                if (--unpack <= 0) {
                                    DataStack.pop();
                                    let seqNode = DataStack.pop();
                                    if (seqNode instanceof AST.ASTChainStore) {
                                        seqNode.line = code.Current.LineNo;
                                        PycDecompiler.append_to_chain_store(seqNode, tupleNode, DataStack, curBlock);
                                    } else {
                                        let node = new AST.ASTStore(seqNode, tupleNode);
                                        node.line = code.Current.LineNo;
                                        curBlock.append(node);
                                    }
                                }
                            } else {
                                let subscrNode = DataStack.pop();
                                let destNode = DataStack.pop();
                                let srcNode = DataStack.pop();
            
                                // If variable annotations are enabled, we'll need to check for them here.
                                // Python handles a varaible annotation by setting:
                                // __annotations__['var-name'] = type
                                let found_annotated_var = (variable_annotations && destNode instanceof AST.ASTName
                                    && destNode.name == "__annotations__");
            
                                if (found_annotated_var) {
                                    // Annotations can be done alone or as part of an assignment.
                                    // In the case of an assignment, we'll see a NODE_STORE on the DataStack.
                                    if (!curBlock.nodes.empty() && curBlock.nodes.top() instanceof AST.ASTStore) {
                                        // Replace the existing NODE_STORE with a new one that includes the annotation.
                                        let store = curBlock.nodes.top();
                                        curBlock.removeLast();
                                        let node = new AST.ASTStore(store.src,
                                            new AST.ASTAnnotatedVar(subscrNode, srcNode)
                                        );
                                        node.line = code.Current.LineNo;
                                        curBlock.append(node);
                                    } else {
                                        let node = new AST.ASTAnnotatedVar(subscrNode, srcNode);
                                        node.line = code.Current.LineNo;
                                        curBlock.append(node);
                                    }
                                } else {
                                    if (destNode instanceof AST.ASTMap) {
                                        destNode.add(subscrNode, srcNode);
                                    } else if (srcNode instanceof AST.ASTChainStore) {
                                        PycDecompiler.append_to_chain_store(srcNode, new AST.ASTSubscr(destNode, subscrNode), DataStack, curBlock);
                                    } else {
                                        let node = new AST.ASTStore(srcNode,
                                            new AST.ASTSubscr(destNode, subscrNode)
                                        );
                                        node.line = code.Current.LineNo;
                                        curBlock.append(node);
                                    }
                                }
                            }
                        }
                        break;
                        case OpCodes.UNARY_CALL:
                        {
                            let funcNode = DataStack.pop();
                            let node = new AST.ASTCall(funcNode, [], []);
                            node.line = code.Current.LineNo;
                            DataStack.push(node);
                        }
                        break;
                        case OpCodes.UNARY_CONVERT:
                            {
                                let name = DataStack.pop();
                                let node = new AST.ASTConvert(name);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);
                            }
                            break;
                        case OpCodes.UNARY_INVERT:
                            {
                                let arg = DataStack.pop();
                                let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Invert);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);    
                            }
                            break;
                        case OpCodes.UNARY_NEGATIVE:
                            {
                                let arg = DataStack.pop();
                                let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Negative);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);    
                            }
                            break;
                        case OpCodes.UNARY_NOT:
                            {
                                let arg = DataStack.pop();
                                let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Not);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);    
                            }
                            break;
                        case OpCodes.UNARY_POSITIVE:
                            {
                                let arg = DataStack.pop();
                                let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Positive);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);    
                            }
                            break;
                        case OpCodes.UNPACK_LIST_A:
                        case OpCodes.UNPACK_TUPLE_A:
                        case OpCodes.UNPACK_SEQUENCE_A:
                        {
                            unpack = code.Current.Argument;
                            if (unpack > 0) {
                                let node = new AST.ASTTuple([]);
                                node.line = code.Current.LineNo;
                                DataStack.push(node);    
                            } else {
                                // Unpack zero values and assign it to top of stack or for loop variable.
                                // E.g. [] = TOS / for [] in X
                                let tupleNode = new AST.ASTTuple([]);
                                if (curBlock.blockType == AST.ASTBlock.BlockType.For
                                    && !curBlock.inited) {
                                    tupleNode.requireParens = true;
                                    curBlock.index = tupleNode;
                                } else if (DataStack.top() instanceof AST.ASTChainStore) {
                                    let chainStore = DataStack.pop();
                                    chainStore.line = code.Current.LineNo;
                                    PycDecompiler.append_to_chain_store(chainStore, tupleNode, DataStack, curBlock);
                                } else {
                                    let node = new AST.ASTStore(DataStack.pop(), tupleNode);
                                    node.line = code.Current.LineNo;
                                    curBlock.append(node);
                                }
                            }
                        }
                        break;
                        case OpCodes.YIELD_FROM:
                        {
                            let dest = DataStack.pop();
                            // TODO: Support yielding into a non-null destination
                            let valueNode = DataStack.top();
                            if (valueNode) {
                                let node = new AST.ASTReturn(valueNode, AST.ASTReturn.RetType.YieldFrom);
                                node.line = code.Current.LineNo;
                                curBlock.append(node);
                            }
                        }
                        break;
                        case OpCodes.YIELD_VALUE:
                        case OpCodes.INSTRUMENTED_YIELD_VALUE_A:
                        {
                            let value = DataStack.pop();
                            let node = new AST.ASTReturn(value, AST.ASTReturn.RetType.Yield);
                            node.line = code.Current.LineNo;
                            curBlock.append(node);
                        }
                        break;
                        case OpCodes.SETUP_ANNOTATIONS:
                        {
                            variable_annotations = true;
                        }
                        break;
                        case OpCodes.PRECALL_A:
                        case OpCodes.RESUME_A:
                        case OpCodes.INSTRUMENTED_RESUME_A:
                            /* We just entirely ignore this / no-op */
                            break;
                        case OpCodes.CACHE:
                            /* These "fake" opcodes are used as placeholders for optimizing
                               certain opcodes in Python 3.11+.  Since we have no need for
                               that during disassembly/decompilation, we can just treat these
                               as no-ops. */
                            break;
                        case OpCodes.PUSH_NULL:
                        {
                            DataStack.push(null);
                        }
                        break;
                        case OpCodes.GEN_START_A:
                        {
                            DataStack.pop();
                        }
                        break;
                        case OpCodes.RESERVE_FAST_A:
                        {
                            let list = [];
                            code.Current.ConstantObject.Value.map(el => list[el.value] = el.key);
                            DataStack.push(list);
                        }
                        break;
                        case OpCodes.UNPACK_ARG_A:
                        {
                            let data = DataStack.pop();
                            obj.ArgCount = code.Current.Argument;
                            for (let idx = 0; idx < code.Current.Argument; idx++) {                                
                                obj.VarNames.Value.push(data[idx]);
                            }
                            code.GoNext(code.Current.Argument);
                        }
                        break;
                        case OpCodes.BINARY_CALL:
                        {
                            let paramsTuple = DataStack.pop();
                            let func = DataStack.pop();
                            let params = [];

                            if (paramsTuple instanceof AST.ASTTuple) {
                                params = paramsTuple.values;
                            }

                            let callNode = new AST.ASTCall(func, params);
                            DataStack.push(callNode);
                        }
                        break;
                        case OpCodes.UNPACK_EX_A:
                            unpack = (code.Current.Argument & 0xFF);
                            starPos = unpack;
                            unpack += 1 + (code.Current.Argument >> 8) & 0xFF;

                            let source = DataStack.pop();
                            let tuple = new AST.ASTTuple([]);
                            tuple.requireParens = false;
                            DataStack.push(new PycObject("Py_Null"));
                            DataStack.push(new AST.ASTChainStore([], source));
                            DataStack.push(tuple);
                        break;
                        default:
                        {
                            console.error(`Unsupported opcode ${code.Current.InstructionName} at pos ${code.Current.Offset}\n`);
                            PycDecompiler.cleanBuild = false;
                            let node = new AST.ASTNodeList(defBlock.nodes);
                            return node;
                        }
                    }
                    else_pop = [AST.ASTBlock.BlockType.Else,
                                AST.ASTBlock.BlockType.If,
                                AST.ASTBlock.BlockType.Elif
                               ].includes(curBlock.blockType)
                            && (curBlock.end == code.Next?.Offset);

            } catch (ex) {
                console.error(`EXCEPTION for OpCode ${code.Current.InstructionName} (${code.Current.Argument}) at offset ${code.Current.Offset} in code object '${obj.Name}' : ${ex.message}\n\n`);
            }
        }
    
        if (blocks.length > 1) {
            console.error("Warning: block stack is not empty!\n");
    
            while (blocks.length > 1) {
                let tmp = blocks.pop();
    
                blocks.top().append(tmp);
            }
        }
    
        PycDecompiler.cleanBuild = true;
        let mainNode = new AST.ASTNodeList(defBlock.nodes);
        return mainNode;
    }
}

module.exports = PycDecompiler;