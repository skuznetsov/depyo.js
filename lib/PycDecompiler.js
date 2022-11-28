const OpCodes = require('./OpCodes');
// const {PythonObject, PythonCodeObject} = require('./PythonObject');
const PycResult = require('./PycResult');

class PycDecompiler {

    static Decompile (obj) {
        if (obj == null) {
            return null;
        }

        let code = new OpCodes(obj);
        let DataStack = [];

        let funcBody = PycDecompiler.Stmts(obj, code, DataStack);
        if (funcBody.Result.length > 0) {
            return funcBody;
        }

        return null;
    }


    static Stmts (obj, code, DataStack, endOffset = 0) {
        let nextOpCode = null;

        if (obj == null) {
            return null;
        }

        let result = new PycResult();

        while (code.HasInstructionsToProcess) {
            try {
                if (endOffset > 0) {
                    if (code.PeekNextInstruction().Offset >= endOffset) {
                        if (DataStack.length > 0 && !result.HasResult) {
                            result.Add(DataStack.pop());
                        }
                        return result;
                    }
                }
                
                code.GetNextInstruction();

                switch (code.Current.OpCodeID)
                {
                    case OpCodes.WITH_CLEANUP:
                        break;
                    case OpCodes.LOAD_LOCALS:
                        break;
                    case OpCodes.UNPACK_SEQUENCE:
                        break;
                    case OpCodes.POP_BLOCK:
                        break;
                    case OpCodes.JUMP_FORWARD:
                        break;
                    case OpCodes.JUMP_ABSOLUTE:
                        break;
                    case OpCodes.POP_JUMP_IF_FALSE:
                        PycDecompiler.DecompileIfExpression(obj, code, DataStack, result);
                        break;
                    case OpCodes.POP_JUMP_IF_TRUE:
                        // Used in case: assert: expr POP_JUMP_IF_TRUE LOAD_GLOBAL RAISE_VARARGS(1,2)
                        // In case of peephole optimizer it can be the case of optimisation of 
                        // 'if not <expression>' so it should be decoded in DecompileIfExpression
                        nextOpCode = code.PeekNextInstruction();
                        let raiseOffset = code.GetOffsetByOpCode(OpCodes.RAISE_VARARGS);
                        if (raiseOffset > 0 && nextOpCode.OpCodeID == OpCodes.LOAD_GLOBAL) {
                            let testCondition = DataStack.pop();
                            let raiseOp = code.PeekInstructionAtOffset(raiseOffset);
                            let msg = null;
                            if (raiseOp.Argument == 2) {
                                msg = PycDecompiler.Expr(obj, code, DataStack, raiseOffset);
                            }
                            result.Add("assert " + testCondition + (msg == "" ? "" : ", ") + msg);
                        } else {
                            PycDecompiler.DecompileIfExpression(obj, code, DataStack, result);
                        }
                        break;
                    case OpCodes.SETUP_LOOP:
                        let jumpTarget = code.Current.JumpTarget;
                        let forOffset = -1, 
                            getIterOffset = -1,
                            jumpOffset = -1;

                        forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER);
                        getIterOffset = code.GetOffsetByOpCode(OpCodes.GET_ITER);
                        
                        if (forOffset > 0) {
                            nextOpCode = code.PeekInstructionAtOffset(forOffset);
                            jumpOffset = nextOpCode.JumpTarget;
                        } else {
                            // TODO: Figure out cases when it can be wrong
                            jumpOffset = code.GetOffsetByOpCode(OpCodes.JUMP_ABSOLUTE);
                        }

                        if (forOffset >= 0 && forOffset < jumpOffset && jumpOffset < jumpTarget) {
                            let inExpr = PycDecompiler.Expr(obj, code, DataStack, getIterOffset);
                            code.GetNextInstruction();
                            code.GetNextInstruction();
                            let forJump = code.Current.JumpTarget;
                            let forExpr = PycDecompiler.Expr(obj, code, DataStack);
                            result.Add("for " + forExpr + " in " + inExpr + ":");
                            let forBody = PycDecompiler.Stmts(obj, code, DataStack, forJump);
                            result.Add(forBody);

                            if (forJump < jumpTarget) {
                                code.GetNextInstruction();
                                if (code.Current.Argument > 0) {
                                    let elseBody = PycDecompiler.Stmts(obj, code, DataStack, jumpTarget);
                                    if (elseBody.HasResult) {
                                        result.Add("else:");
                                        result.Add(elseBody);
                                    }
                                }
                            }
                        } else {
                            let ifOffset = code.GetOffsetByOpCodeName("POP_JUMP_IF_");
                            let elseOffset = 0;
                            let testCondition = "";
                            let ifOp = code.PeekInstructionAtOffset(ifOffset);
                            let ifOpLine = obj.LineNoTab[ifOp.Offset];
                            let whileLine = obj.LineNoTab[code.Current.Offset];

                            if (ifOpLine == whileLine) {
                                [testCondition, jumpOffset] = PycDecompiler.ExtractTestCondition(obj, code, DataStack, jumpOffset);
                                elseOffset = code.PeekInstructionBeforeOffset(ifOp.JumpTarget).Offset;
                            } else {
                                testCondition = "1";
                            }
                            result.Add("while " + testCondition + ":");
                            let whileBody = PycDecompiler.Stmts(obj, code, DataStack, jumpOffset);
                            result.Add(whileBody);
                            code.GetNextInstruction();
                            let elseBody = PycDecompiler.Stmts(obj, code, DataStack, jumpTarget);
                            if (elseBody.HasResult) {
                                result.Add("else:");
                                result.Add(elseBody);
                            }
                        }
                        break;
                    case OpCodes.SETUP_EXCEPT:
                        {
                            result.Add("try:");
                            let jumpTarget = code.Current.JumpTarget;
                            //TODO: Modify jumpTarget - 4 code
                            let bodyStmt = PycDecompiler.Stmts(obj, code, DataStack, jumpTarget - 4);
                            result.Add(bodyStmt);
                            code.GetNextInstruction(); // POP_BLOCK
                            code.GetNextInstruction(); // jump to else block;
                            let elseJump = code.Current.JumpTarget;
                            let endJump = 0;

                            while (true) {
                                let excJump = 0;
                                let exceptHandlerType = null;
                                let varName = null;
                            
                                if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                    // except handler type
                                    code.SkipInstruction();
                                    exceptHandlerType = PycDecompiler.Expr(obj, code, DataStack, code.GetOffsetByOpCode(OpCodes.COMPARE_OP));
                                    code.SkipInstruction();
                                    excJump = code.GetNextInstruction().Argument;
                                }

                                code.SkipInstruction();
                                nextOpCode = code.PeekNextInstruction();
                                
                                if (nextOpCode.OpCodeID != OpCodes.POP_TOP) {
                                    varName = PycDecompiler.Expr(obj, code, DataStack, code.GetOffsetByOpCode(OpCodes.POP_TOP));
                                } else {
                                    code.SkipInstruction();
                                }

                                code.SkipInstruction();
                                let excBody = null;
                                
                                if (excJump > 0) {
                                    nextOpCode = code.PeekInstructionAtOffset(excJump - 3);
                                    if (nextOpCode != null) {
                                        if (nextOpCode.OpCodeID == OpCodes.JUMP_FORWARD || nextOpCode.OpCodeID == OpCodes.JUMP_ABSOLUTE) {
                                            endJump = nextOpCode.JumpTarget;
                                        }
                                    }
                                }

                                endJump = (endJump == 0) ? elseJump : endJump;
                                excBody = PycDecompiler.Stmts(obj, code, DataStack, excJump == 0 ? elseJump : excJump);

                                if (exceptHandlerType != null && varName != null) {
                                    result.Add(`except ${exceptHandlerType} as ${varName}:`);
                                } else if (exceptHandlerType != null && varName == null) {
                                    result.Add(`except ${exceptHandlerType}:`);
                                } else {
                                    result.Add("except:");
                                }

                                if (excBody.HasResult) {
                                    result.Add(excBody);
                                } else {
                                    result.Add("pass");
                                }

                                if (excJump == 0) {
                                    break;
                                }

                                if (code.PeekInstructionAtOffset(excJump).OpCodeID == OpCodes.END_FINALLY) {
                                    code.GetNextInstruction(); // END_FINALLY
                                    break;
                                }
                            }
                            if (code.Current.Offset + 1 < endJump) {
                                let elseBody = PycDecompiler.Stmts(obj, code, DataStack, endJump);
                                if (elseBody.HasResult) {
                                    result.Add("else:");
                                    result.Add(elseBody);
                                }
                            }
                        }
                        break;
                    case OpCodes.SETUP_FINALLY:
                        let finallyBodyAddress = code.Current.JumpTarget;
                        // TODO: Re-do fiallyBodyAddress - 4
                        let bodyStmts = PycDecompiler.Stmts(obj, code, DataStack, finallyBodyAddress - 4);
                        code.SkipInstruction(2);
                        let endFinallyAddress = code.GetOffsetByOpCode(OpCodes.END_FINALLY);
                        let finallyBodyStmts = PycDecompiler.Stmts(obj, code, DataStack, endFinallyAddress);
                        result.Add("try:");
                        result.Add(bodyStmts);
                        result.Add("finally:");
                        result.Add(finallyBodyStmts);
                        break;
                    case OpCodes.MAKE_FUNCTION:
                    case OpCodes.MAKE_CLOSURE:
                        let const_idx = DataStack.pop();
                        // UGLY HACK!!!
                        let child_co = obj.Consts.Value[const_idx];

                        if (code.Current.OpCodeID == OpCodes.MAKE_CLOSURE) {
                            DataStack.pop();
                        }

                        let default_params = [];
                        if (code.Current.Argument > 0) {
                            let count = code.Current.Argument;
                            while (count-- > 0) {
                                default_params.push(DataStack.pop());
                            }

                            default_params.Reverse();
                        }

                        if (child_co.Name == "<lambda>") {
                            PycDecompiler.MakeLambda(child_co, DataStack, default_params);
                            break;
                        }

                        child_co.SourceCode = PycDecompiler.Decompile(child_co, default_params);
                        if (!child_co.SourceCode) {
                            child_co.SourceCode = new PycResult("pass");
                        }
                        obj.Methods[child_co.Name] = child_co;
                        nextOpCode = code.PeekNextInstruction();
                        child_co.FuncName = child_co.Name;
                        child_co.FuncDecos = new PycResult();

                        if (child_co.Name != "<module>") {
                            let pars = "";
                            if (child_co.ArgCount > 0) {
                                for (let i = 0; i < child_co.ArgCount; i++) {
                                    let param = child_co.VarNames.Value[i].toString();
                                    
                                    if ((i + 1) > (child_co.ArgCount - default_params.length)) {
                                        param += " = " + default_params[i - (child_co.ArgCount - default_params.length)];
                                    }

                                    pars += pars == "" ? param : ", " + param;
                                }
                            }
                            child_co.FuncParams = pars;
                        }

                        if (nextOpCode.InstructionName == "CALL_FUNCTION" && nextOpCode.Argument == 0 && code.PeekNextInstruction(2).OpCodeID == OpCodes.BUILD_CLASS) {
                            code.GetNextInstruction();
                            break;
                        } else if (nextOpCode.OpCodeID == OpCodes.CALL_FUNCTION && nextOpCode.Argument == 1) {
                            while (nextOpCode.OpCodeID == OpCodes.CALL_FUNCTION && nextOpCode.Argument == 1) {
                                code.SkipInstruction();
                                let  functionDecorator = "";
                                if (DataStack.length > 0) {
                                    functionDecorator = DataStack.pop();
                                }

                                child_co.FuncDecos.Add("@" + functionDecorator);
                                nextOpCode = code.PeekNextInstruction();
                            }
                        } else if (code.PeekPrevInstruction().InstructionName.startsWith("LOAD_") && DataStack.length > 0) {
                            child_co.FuncName = DataStack[DataStack.length-1];
                        }

                        if (nextOpCode.InstructionName.startsWith("STORE_")) {
                            nextOpCode = code.GetNextInstruction();
                            child_co.FuncName = nextOpCode.Name;
                        }

                        // We are separating functions by one empty (let configure it later if needed) line
                        result.Add("");
                        if (child_co.SourceCode.HasResult && !child_co.Name.startsWith("<")) {
                            if (child_co.FuncDecos.HasResult) {
                                for (let functionDecorator of child_co.FuncDecos.Result) {
                                    result.Add(functionDecorator);
                                }
                            }
                            result.Add(`def ${child_co.FuncName || child_co.Name}(${child_co.FuncParams}):`);
                            result.Add(child_co.SourceCode);
                        }
                        break;
                    case OpCodes.BUILD_CLASS:
                        let baseClass = DataStack.pop();
                        let className = DataStack.pop().replace(/\'/g, '');

                        // If we have some decompiled output already we should separate it by one (or more?) empty line
                        if (result.HasResult) {
                            result.Add("");
                        }

                        let classDefinition = `class ${className}${baseClass == "()" ? "" : " " + baseClass}:`;
                        let classBody = null;
                        let funcCodeObject = obj.Methods[className];

                        if (funcCodeObject != null) {
                            classBody = funcCodeObject.SourceCode;
                        }
                        
                        code.GetNextInstruction();
                        result.Add(classDefinition);
                        if (classBody == null || !classBody.HasResult) {
                            result.IncreaseIndent();
                            result.Add("pass");
                            result.DecreaseIndent();
                        } else {
                            result.Add(classBody);
                        }
                        result.Add("");

                        break;
                    case OpCodes.SETUP_WITH:
                        break;
                    case OpCodes.SET_ADD:
                        break;
                    case OpCodes.MAP_ADD:
                        break;
                    default:
                        if (code.CurrentInstructionIndex >= 0) {
                            code.CurrentInstructionIndex--;
                        }

                        let res = PycDecompiler.Expr(obj, code, DataStack, endOffset);
                        if (res != "") {
                            result.Add(res);
                        }
                        break;
                }
            }
            catch (ex) {
                result.Add(`EXCEPTION for OpCode ${code.Current.InstructionName} (${code.Current.Argument}) at offset ${code.Current.Offset} : ${ex.Message}\n\n`);
            }
        }
        return result;
    }

    static MakeLambda(child_co, DataStack, default_params) {
        let code = new OpCodes(child_co);
        let source = PycDecompiler.Stmts(child_co, code, DataStack);
        let pars = "";

        if (child_co.ArgCount > 0) {
            pars = " ";
            for (let idx = 0; idx < child_co.ArgCount; idx++)
            {
                let param = child_co.VarNames[idx];
                if ((idx + 1) > (child_co.ArgCount - default_params.length)) {
                    param += " = " + default_params[idx - (child_co.ArgCount - default_params.length)];
                }
                pars += pars == " " ? param : ", " + param;
            }
        }

        if (source.Result.length > 1) {
            DataStack.push(`lambda${pars}: (${source.Result.join(",")})`);
        } else {
            DataStack.push(`lambda${pars}: ${source.Result}`);
        }
    }

    static DecompileIfExpression(obj, code, DataStack, result) {
        let jumpOffset = code.Current.JumpTarget;
        let opIndex = code.GetIndexByOffset(jumpOffset);
        let jumpOpcode = code.PeekInstructionAt(opIndex - 1);
        let elseOffset = jumpOpcode.OpCodeID == OpCodes.JUMP_FORWARD ? jumpOpcode.JumpTarget : null;
        let ifTest = "", ifTestPart = "";
        let ifBody = null;
        let ifElseBody = null;

        // let isIfExp = code.Current.OpCodeID == OpCodes.POP_JUMP_IF_FALSE && elseOffset !== null;
        // let isIfNotExp = code.Current.OpCodeID == OpCodes.POP_JUMP_IF_TRUE && elseOffset !== null;

        // if (isIfNotExp) {
        //     DataStack.push('not ' + DataStack.pop());
        // }

        // if (!isIfExp) {
            ifTest = DataStack.pop();
        // }

        [ifTestPart, jumpOffset] = PycDecompiler.ExtractTestCondition(obj, code, DataStack, jumpOffset);
        ifTest += ifTestPart;

        ifBody = PycDecompiler.Stmts(obj, code, DataStack, jumpOffset);
        
        if (code.Current.OpCodeID == OpCodes.JUMP_FORWARD) {
            if (code.Current.Offset < jumpOffset && code.Current.Argument > 0) {
                let jumpTarget = code.Current.JumpTarget;
                ifElseBody = PycDecompiler.Stmts(obj, code, DataStack, jumpTarget);
            }
        }

        // if (isIfExp) {
        //     DataStack.push(ifBody.Result[0] + " if " + ifTest + " else " + ifElseBody.Result[0]);
        // } else {
            result.Add("if " + ifTest + ":");
            result.Add(ifBody);

            if (ifElseBody != null && ifElseBody.HasResult) {
                result.Add("else:");
                result.Add(ifElseBody);
            }
        // }
    }

    static ExtractTestCondition(obj, code, DataStack, endOffset) {
        let ifTest = "";
        let jumpOffset = endOffset;

        if (code.CountSpecificOpCodes([OpCodes.JUMP_IF_FALSE_OR_POP, OpCodes.JUMP_IF_TRUE_OR_POP], code.Current.Offset, endOffset)
             && code.Current.Offset < endOffset) {
            while (code.Current.Offset < endOffset) {
                let op = "";
                if (code.Current.OpCodeID == OpCodes.JUMP_IF_FALSE_OR_POP)
                    op = " and ";
                else if (code.Current.OpCodeID == OpCodes.JUMP_IF_TRUE_OR_POP)
                    op = " or ";
                let temp = PycDecompiler.Expr(obj, code, DataStack, endOffset);
                if (temp == "")
                {
                    temp = DataStack.pop();
                }
                ifTest += op + temp;
                code.SkipInstruction();
                jumpOffset = code.Current.JumpTarget;
            }
        }

        return [ifTest, jumpOffset];
    }

    static Expr (obj, code, DataStack, endOffset = 0) {
        if (obj == null || endOffset == -1) {
            return "";
        }

        let nextOpCode = null;

        while (code.HasInstructionsToProcess) {
            try {
                if (endOffset > 0) {
                    if (code.PeekNextInstruction().Offset >= endOffset) {
                        if (DataStack.length > 0) {
                            return DataStack.pop();
                        } else {
                            return "";
                        }
                    }
                }
                code.GetNextInstruction();

                switch (code.Current.OpCodeID) {
                    case OpCodes.POP_TOP:
                        return DataStack.pop();
                    case OpCodes.ROT_TWO:
                        {
                            let value1 = DataStack.pop();
                            let value2 = DataStack.pop();
                            DataStack.push(value1);
                            DataStack.push(value2);
                        }
                        break;
                    case OpCodes.ROT_THREE:
                        {
                            let value1 = DataStack.pop();
                            let value2 = DataStack.pop();
                            let value3 = DataStack.pop();
                            DataStack.push(value1);
                            DataStack.push(value2);
                            DataStack.push(value3);
                        }
                        break;
                    case OpCodes.DUP_TOP:
                        {
                            let value = DataStack[DataStack.length - 1];
                            DataStack.push(value);
                        }
                        break;
                    case OpCodes.ROT_FOUR:
                        {
                            let value1 = DataStack.pop();
                            let value2 = DataStack.pop();
                            let value3 = DataStack.pop();
                            let value4 = DataStack.pop();
                            DataStack.push(value1);
                            DataStack.push(value2);
                            DataStack.push(value3);
                            DataStack.push(value4);
                        }
                        break;
                    case OpCodes.NOP:
                        break;
                    case OpCodes.UNARY_POSITIVE:
                        {
                            let value = DataStack.pop();
                            value = value[0] == '-' ? value.sublet(1) : value;
                            DataStack.push(value);
                        }
                        break;
                    case OpCodes.UNARY_NEGATIVE:
                        {
                            let value = DataStack.pop();
                            value = value[0] == '-' ? value : value.sublet(1);
                            DataStack.push(value);
                        }
                        break;
                    case OpCodes.UNARY_NOT:
                        {
                            let value = DataStack.pop();
                            value = "not " + value;
                            DataStack.push(value);
                        }
                        break;
                    case OpCodes.UNARY_CONVERT:
                        break;
                    case OpCodes.UNARY_INVERT:
                        {
                            let value = DataStack.pop();
                            value = "~" + value;
                            DataStack.push(value);
                        }
                        break;
                    case OpCodes.BINARY_POWER:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " ** " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_MULTIPLY:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")){
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " * " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_DIVIDE:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }
                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " / " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_MODULO:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " % " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_ADD:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " + " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_SUBTRACT:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " - " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_SUBSCR:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(`${lVal}[${rVal}]`);
                        }
                        break;
                    case OpCodes.BINARY_FLOOR_DIVIDE:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " // " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_TRUE_DIVIDE:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " / " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_FLOOR_DIVIDE:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " // " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_TRUE_DIVIDE:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " / " + rVal);
                        }
                        break;
                    case OpCodes.SLICE:
                        DataStack.push(DataStack.pop() + "[:]");
                        break;
                    case OpCodes.SLICE1:
                        {
                            let startIndex = DataStack.pop();
                            let name = DataStack.pop();
                            DataStack.push(name + "[" + startIndex + ":]");
                        }
                        break;
                    case OpCodes.SLICE2:
                        {
                            let endIndex = DataStack.pop();
                            let name = DataStack.pop();
                            DataStack.push(name + "[:" + endIndex + "]");
                        }
                        break;
                    case OpCodes.SLICE3:
                        {
                            let startIndex = DataStack.pop();
                            let endIndex = DataStack.pop();
                            let name = DataStack.pop();
                            DataStack.push(name + "[" + startIndex + ":" + endIndex + "]");
                        }
                        break;
                    case OpCodes.STORE_SLICE:
                        {
                            let name = DataStack.pop();
                            if (DataStack.length == 0)
                                return name + "[:]";
                            let value = DataStack.pop();
                            let expr = name + "[:] = " + value;
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.STORE_SLICE1:
                        {
                            let startIndex = DataStack.pop();
                            let name = DataStack.pop();
                            
                            if (DataStack.length > 0) {
                                return name + "[" + startIndex + ":]";
                            }
                            
                            let value = DataStack.pop();
                            let expr = name + "[" + startIndex + ":] = " + value;
                            
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.STORE_SLICE2:
                        {
                            let endIndex = DataStack.pop();
                            let name = DataStack.pop();

                            if (DataStack.length > 0) {
                                return name + "[:" + endIndex + "]";
                            }

                            let value = DataStack.pop();
                            let expr = name + "[" + endIndex + ":] = " + value;
                            
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.STORE_SLICE3:
                        {
                            let startIndex = DataStack.pop();
                            let endIndex = DataStack.pop();
                            let name = DataStack.pop();

                            if (DataStack.length > 0) {
                                return name + "[" + startIndex + ":" + endIndex + "]";
                            }

                            let value = DataStack.pop();
                            let expr = name + "[" + startIndex + ":" + endIndex + ":] = " + value;
                            
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.DELETE_SLICE:
                        return "del " + DataStack.pop() + "[:]";
                    case OpCodes.DELETE_SLICE1:
                        {
                            let startIndex = DataStack.pop();
                            let name = DataStack.pop();
                            return "del " + name + "[" + startIndex + ":]";
                        }
                    case OpCodes.DELETE_SLICE2:
                        {
                            let endIndex = DataStack.pop();
                            let name = DataStack.pop();
                            return "del " + name + "[:" + endIndex + "]";
                        }
                    case OpCodes.DELETE_SLICE3:
                        {
                            let startIndex = DataStack.pop();
                            let endIndex = DataStack.pop();
                            let name = DataStack.pop();
                            return "del " + name + "[" + startIndex + ":" + endIndex + "]";
                        }
                    case OpCodes.STORE_MAP:
                        {
                            let key = DataStack.pop();
                            let value = DataStack.pop();
                            return key + ": " + value;
                        }
                    case OpCodes.INPLACE_ADD:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " + " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_SUBTRACT:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " - " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_MULTIPLY:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " * " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_DIVIDE:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " / " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_MODULO:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " % " + rVal);
                        }
                        break;
                    case OpCodes.STORE_SUBSCR:
                        {
                            let subscript = DataStack.pop();
                            let name = DataStack.pop();
                            if (DataStack.length == 0) {
                                return name + "[" + subscript + "]";
                            }

                            let value = DataStack.pop();
                            let expr = name + "[" + subscript + "] = " + value;

                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.DELETE_SUBSCR:
                        {
                            let subscript = DataStack.pop();
                            let name = DataStack.pop();
                            return "del " + name + "[" + subscript + "]";
                        }
                    case OpCodes.BINARY_LSHIFT:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " << " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_RSHIFT:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " >> " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_AND:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " & " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_XOR:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " ^ " + rVal);
                        }
                        break;
                    case OpCodes.BINARY_OR:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            DataStack.push(lVal + " | " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_POWER:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            
                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " ** " + rVal);
                        }
                        break;
                    case OpCodes.GET_ITER:
                        if ((DataStack.length > 1 && 
                            code.PeekNextInstruction().OpCodeID == OpCodes.CALL_FUNCTION && code.PeekNextInstruction().Argument == 1 
                            && code.PeekNextInstruction(2).OpCodeID == OpCodes.CALL_FUNCTION && code.PeekNextInstruction(2).Argument == 1) ||
                            (DataStack.length >= 1 && code.PeekNextInstruction().OpCodeID == OpCodes.CALL_FUNCTION && code.PeekNextInstruction().Argument == 1))
                        {
                            code.SkipInstruction(DataStack.length > 1 ? 2 : 1);
                            let iter = DataStack.pop();
                            let funcName = "";

                            if (DataStack.length > 0) {
                                funcName = DataStack.pop();
                            }

                            let makeFunctionOffset = code.GetBackOffsetByOpCodeName("MAKE_");
                            let objectConst = code.PeekInstructionBeforeOffset(makeFunctionOffset);

                            if (objectConst == null) {
                                throw new Error("objectConst is null");
                            }

                            let co = obj.Consts.Value[objectConst.Argument];
                            let source = co.SourceCode.Result[0].replace(".0", iter );
                            DataStack.push(`${funcName}(${source})`);
                            break;
                        }
                        return "";
                    case OpCodes.PRINT_EXPR:
                    case OpCodes.PRINT_ITEM:
                        if (code.PeekNextInstruction().OpCodeID == OpCodes.PRINT_NEWLINE) {
                            code.SkipInstruction();
                            return "print " + DataStack.pop();
                        } else {
                            return "print " + DataStack.pop() + ",";
                        }
                    case OpCodes.PRINT_NEWLINE:
                        break;
                    case OpCodes.PRINT_ITEM_TO:
                        {
                            let separator = "";
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.PRINT_NEWLINE_TO) {
                                separator = ",";
                            }

                            let printStmt = "print >> " + DataStack.pop() + ", " + DataStack.pop() + separator;
                            
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.PRINT_NEWLINE_TO) {
                                code.SkipInstruction();
                                DataStack.pop();
                            }
                            return printStmt;
                        }
                    case OpCodes.PRINT_NEWLINE_TO:
                        break;
                    case OpCodes.INPLACE_LSHIFT:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " << " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_RSHIFT:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " >> " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_AND:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " & " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_XOR:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " ^ " + rVal);
                        }
                        break;
                    case OpCodes.INPLACE_OR:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push(lVal + " | " + rVal);
                        }
                        break;
                    case OpCodes.BREAK_LOOP:
                        return "break";
                    case OpCodes.WITH_CLEANUP:
                        return "";
                    case OpCodes.LOAD_LOCALS:
                        return "";
                    case OpCodes.RETURN_VALUE:
                        {
                            let expr = "";
                            if (DataStack.length > 1) {
                                expr = DataStack.pop();
                                while (DataStack.length > 0) {
                                    if (DataStack[DataStack.length - 1].EndsWith(" and ") || DataStack[DataStack.length - 1].EndsWith(" or ")) {
                                        expr = DataStack.pop() + expr;
                                    } else {
                                        break;
                                    }
                                }
                            } else if (DataStack.length > 0) {
                                expr = DataStack.pop();
                            } else if (code.PeekPrevInstruction().OpCodeID == OpCodes.LOAD_LOCALS) {
                                return "";
                            }

                            if (["<lambda>", "<dictcomp>", "<setcomp>"].includes(obj.Name)) {
                                return expr;
                            }

                            if (code.Current.Offset + 1 < obj.Code.Length) {
                                return "return" + (expr == "None" ? "" : " " + expr);
                            } else if (obj.Code.Length < 5) {
                                return "return" + (expr == "None" ? "" : " " + expr);
                            } else {
                                if (expr != "None" && expr != "") {
                                    return "return " + expr;
                                }
                                return "";
                            }
                        }
                    case OpCodes.IMPORT_STAR:
                        break;
                    case OpCodes.EXEC_STMT:
                        return "exec " + DataStack.pop();
                    case OpCodes.YIELD_VALUE:
                        return "yield " + DataStack.pop();
                    case OpCodes.POP_BLOCK:
                        return "";
                    case OpCodes.END_FINALLY:
                        return "";
                    case OpCodes.BUILD_CLASS:
                        return code.MoveBack();
                    case OpCodes.STORE_NAME:
                        {
                            if (DataStack.length == 0 || code.PeekPrevInstruction().OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.Name;
                            }

                            let value = DataStack.pop();
                            if (code.Current.Name == "__module__" && value == "__name__") {
                                return "";
                            } else if (code.Current.Name == "__doc__") {
                                return "\"\"\"" + value.replace(/\'/g, '') + "\"\"\"";
                            } else {
                                let expr = code.Current.Name + " = " + value;

                                if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                    code.SkipInstruction();
                                    DataStack.push(expr);
                                    break;
                                } else {
                                    return expr;
                                }

                            }
                        }
                    case OpCodes.DELETE_NAME:
                        return "del " + code.Current.Name;
                    case OpCodes.UNPACK_SEQUENCE:
                        {
                            let prevOp = code.PeekPrevInstruction();
                            let count = code.Current.Argument;
                            let outExpr = "";
                            let rVal = "";

                            if (prevOp.OpCodeID != OpCodes.FOR_ITER) {
                                rVal = DataStack.pop();
                            }

                            for (let idx = 0; idx < count; idx++) {
                                let name = PycDecompiler.Identifier(obj, code, DataStack);
                                outExpr += (idx > 0 ? ", " : "") + name;
                            }

                            if (prevOp.OpCodeID == OpCodes.FOR_ITER) {
                                return outExpr;
                            }

                            return outExpr + " = " + rVal;
                        }
                    case OpCodes.FOR_ITER:
                        nextOpCode = code.PeekPrevInstruction();
                        if (nextOpCode.OpCodeID == OpCodes.LOAD_FAST && nextOpCode.Argument == 0) {
                            if (["<genexpr>", "<dictcomp>", "<setcomp>"].includes(obj.Name)) {
                                DataStack.pop();
                                let target = PycDecompiler.Expr(obj, code, DataStack);
                                let ifExpr = PycDecompiler.Expr(obj, code, DataStack);
                                let yieldExpr = "";

                                if (ifExpr.startsWith("yield ")) {
                                    yieldExpr = ifExpr;
                                    ifExpr = "";
                                } else {
                                    yieldExpr = PycDecompiler.Expr(obj, code, DataStack);
                                }

                                yieldExpr = yieldExpr.replace("yield ", "");
                                
                                if (yieldExpr[0] == '(') {
                                    yieldExpr = yieldExpr.substring(1,yieldExpr.Length - 2);
                                }

                                code.SkipInstruction(2);

                                return `${yieldExpr} for ${target} in ${nextOpCode.LocalName} ${ifExpr}`;
                            } else {
                                DataStack.pop();
                                let target = PycDecompiler.Expr(obj, code, DataStack);
                                let ifExpr = PycDecompiler.Expr(obj, code, DataStack);
                                code.GetNextInstruction();
                                let yieldExpr = PycDecompiler.Expr(obj, code, DataStack).replace(/yield /g, "");
                                code.GetNextInstruction();
                                code.GetNextInstruction();

                                return `${yieldExpr} for ${target} in ${nextOpCode.LocalName} if ${ifExpr}`;
                            }
                        }
                        return "";
                    case OpCodes.LIST_APPEND:
                        return ""; //code.MoveBack();
                    case OpCodes.STORE_ATTR:
                        {
                            let name = DataStack.pop();
                            if (DataStack.length == 0 || code.PeekPrevInstruction().OpCodeID == OpCodes.FOR_ITER) {
                                return name + "." + code.Current.Name;
                            }

                            let value = DataStack.pop();
                            let expr = name + "." + code.Current.Name + " = " + value;
                            
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.DELETE_ATTR:
                        return "del " + DataStack.pop() + "." + code.Current.Name;
                    case OpCodes.STORE_GLOBAL:
                        {
                            if (DataStack.length == 0 || code.PeekPrevInstruction().OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.Name;
                            }

                            let expr = code.Current.Name + "=" + DataStack.pop();
                            
                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.DELETE_GLOBAL:
                        return "del " + code.Current.Name;
                    case OpCodes.DUP_TOPX:
                        if (code.Current.Argument == 2) {
                            let value1 = DataStack[1];
                            let value2 = DataStack[0];
                            DataStack.push(value1);
                            DataStack.push(value2);
                        } else if (code.Current.Argument == 3) {
                            let value1 = DataStack[2];
                            let value2 = DataStack[1];
                            let value3 = DataStack[0];
                            DataStack.push(value1);
                            DataStack.push(value2);
                            DataStack.push(value3);
                        }
                        break;
                    case OpCodes.LOAD_CONST:
                        DataStack.push(code.Current.Constant);
                        break;
                    case OpCodes.LOAD_NAME:
                        DataStack.push(code.Current.Name);
                        break;
                    case OpCodes.BUILD_LIST:
                        {
                            let forOffset = -1,
                                getIterOffset = -1,
                                jumpOffset = -1,
                                setupLoopOffset = -1;
                            
                            forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER);
                            setupLoopOffset = code.GetOffsetByOpCode(OpCodes.SETUP_LOOP);
                            if (code.Current.Argument == 0 && (forOffset == -1 || (setupLoopOffset > 0 && forOffset > setupLoopOffset) || (forOffset - code.Current.Offset) > 35)) {
                                DataStack.push("[]");
                            } else if (code.Current.Argument == 0) {
                                let comp_for = "";
                                forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER);
                                getIterOffset = code.GetOffsetByOpCode(OpCodes.GET_ITER);

                                if (forOffset > 0) {
                                    nextOpCode = code.PeekInstructionAtOffset(forOffset);
                                    jumpOffset = nextOpCode.JumpTarget - 3;
                                } else {
                                    // TODO: Figure out cases when it can be wrong
                                    jumpOffset = code.GetOffsetByOpCode(OpCodes.JUMP_ABSOLUTE);
                                }

                                if (forOffset >= 0 && forOffset < jumpOffset) {
                                    let iter = PycDecompiler.Expr(obj, code, DataStack, getIterOffset);
                                    code.GetNextInstruction();
                                    code.GetNextInstruction();
                                    let target = PycDecompiler.Expr(obj, code, DataStack);
                                    comp_for = ` for ${target} in ${iter}`;
                                }
                                let ifOffset = code.GetOffsetByOpCode(OpCodes.POP_JUMP_IF_FALSE);
                                let ifExpr = "";
                                if (ifOffset >= 0 && ifOffset <= jumpOffset) {
                                    ifExpr = " if " + PycDecompiler.Expr(obj, code, DataStack, ifOffset);
                                    code.GetNextInstruction();
                                }

                                let listAppendOffset = code.GetOffsetByOpCode(OpCodes.LIST_APPEND);
                                let expr = PycDecompiler.Expr(obj, code, DataStack, listAppendOffset);
                                code.GetNextInstruction();
                                code.GetNextInstruction();

                                let list_comp = "[" + expr + comp_for + ifExpr + "]";
                                DataStack.push(list_comp);
                            } else {
                                let list = "[";
                                for (let i = code.Current.Argument - 1; i >= 0; i--) {
                                    list += DataStack[i] + (i > 0 ? ", " : "");
                                }

                                for (let i = 0; i < code.Current.Argument; i++) {
                                    DataStack.pop();
                                }

                                list += "]";
                                DataStack.push(list);
                            }
                            break;
                        }
                    case OpCodes.BUILD_MAP:
                        {
                            let forOffset = -1,
                                getIterOffset = -1,
                                jumpOffset = -1,
                                setupLoopOffset = -1;

                            forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER);
                            setupLoopOffset = code.GetOffsetByOpCode(OpCodes.SETUP_LOOP);

                            if (code.Current.Argument == 0 && (forOffset == -1 || (setupLoopOffset > 0 && forOffset > setupLoopOffset) || (forOffset - code.Current.Offset) > 15)) {
                                DataStack.push("{}");
                            } else if (code.Current.Argument == 0) {
                                let comp_for = "";
                                let genCount = -1;
                                forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER);

                                if (forOffset > 0) {
                                    nextOpCode = code.PeekInstructionAtOffset(forOffset);
                                    jumpOffset = nextOpCode.JumpTarget - 3;
                                    genCount = code.CountSpecificOpCodes(OpCodes.FOR_ITER, jumpOffset);
                                } else {
                                    break;
                                }

                                // TODO: Implement it in a proper way
                                let comprehenstionGenerator = PycDecompiler.RecreateComprehensionGenerator(code, genCount, 0);

                                if (forOffset >= 0 && forOffset < jumpOffset) {
                                    let iter = PycDecompiler.Expr(obj, code, DataStack, forOffset);
                                    code.SkipInstruction(1);
                                    let target = PycDecompiler.Expr(obj, code, DataStack);
                                    comp_for = `for ${target} in ${iter}`;
                                }
                                let ifOffset = code.GetOffsetByOpCode(OpCodes.POP_JUMP_IF_FALSE);
                                let ifExpr = "";

                                if (ifOffset >= 0 && ifOffset <= jumpOffset) {
                                    ifExpr = " if " + PycDecompiler.Expr(obj, code, DataStack, ifOffset);
                                    code.GetNextInstruction();
                                }

                                let mapAddOffset = code.GetOffsetByOpCode(OpCodes.MAP_ADD);
                                let key = PycDecompiler.Expr(obj, code, DataStack, mapAddOffset);
                                let value = PycDecompiler.Expr(obj, code, DataStack, mapAddOffset);
                                code.GetNextInstruction();
                                code.GetNextInstruction();

                                let map_comp = `{${key}: ${value} ${comp_for} ${ifExpr}}`;
                                DataStack.push(map_comp);
                            } else {
                                let count = code.Current.Argument;
                                let mapResult = "{";
                                
                                while (count-- > 0) {
                                    let expr = PycDecompiler.Expr(obj, code, DataStack);
                                    mapResult += (mapResult == "{" ? " " : ", ") + expr;
                                }
                                
                                mapResult += " }";
                                DataStack.push(mapResult);
                            }

                            break;
                        }
                    case OpCodes.BUILD_TUPLE:
                        {
                            // TODO: Check if Argument == 0 then it's generator
                            let forOffset = -1,
                                getIterOffset = -1,
                                jumpOffset = -1,
                                setupLoopOffset = -1;

                            forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER);
                            setupLoopOffset = code.GetOffsetByOpCode(OpCodes.SETUP_LOOP);

                            if (code.Current.Argument == 0 && (forOffset == -1 ||
                                (setupLoopOffset > 0 && forOffset > setupLoopOffset) ||
                                (forOffset - code.Current.Offset) > 15)) {
                                DataStack.push("()");
                            } else if (code.Current.Argument == 0) {
                                // TODO: tuple generator code goes here
                                throw new Error("tuple generator is not implemented yet");
                            } else {
                                let list = [];
                                for (let i = code.Current.Argument - 1; i >= 0; i--) {
                                    list.push(DataStack.pop());
                                }
                                
                                let tuple = `(${list.join(", ")})`;

                                DataStack.push(tuple);
                            }
                            break;
                        }
                    case OpCodes.BUILD_SET:
                        {
                            // TODO: Check if Argument == 0 then it's generator
                            let forOffset = -1,
                                getIterOffset = -1,
                                jumpOffset = -1,
                                setupLoopOffset = -1;

                            forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER);
                            setupLoopOffset = code.GetOffsetByOpCode(OpCodes.SETUP_LOOP);

                            if (code.Current.Argument == 0 && (forOffset == -1 || (setupLoopOffset > 0 && forOffset > setupLoopOffset) || (forOffset - code.Current.Offset) > 15)) {
                                DataStack.push("()");
                            } else if (code.Current.Argument == 0) {
                                // TODO: set generator code goes here
                                throw new Error("set generator is not implemented yet");
                            } else {
                                let set = "{";

                                for (let i = 0; i < code.Current.Argument; i++) {
                                    let value = DataStack.pop();
                                    set += (set == "{") ? value : ", " + value;
                                }
                                
                                set += "}";
                                DataStack.push(set);
                            }
                            break;
                        }
                    case OpCodes.LOAD_ATTR:
                        DataStack.push(DataStack.pop() + "." + code.Current.Name);
                        break;
                    case OpCodes.COMPARE_OP:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();

                            if ((rVal.includes(" - ") || rVal.includes(" + ")) && !rVal.includes("(")) {
                                rVal = "(" + rVal + ")";
                            }

                            if ((lVal.includes(" - ") || lVal.includes(" + ")) && !lVal.includes("(")) {
                                lVal = "(" + lVal + ")";
                            }

                            DataStack.push([lVal, code.Current.CompareOperator, rVal].join(" "));
                        }
                        break;
                    case OpCodes.IMPORT_NAME:
                        {
                            DataStack.pop();
                            if(![0, -1].includes(~~DataStack.pop())) {
                                throw Error("Unexpected stack value for IMPORT_NAME");
                            }

                            let moduleName = code.Current.Name;
                            let nextOpCode = code.PeekNextInstruction();

                            if (nextOpCode.OpCodeID == OpCodes.IMPORT_STAR) {
                                code.SkipInstruction();
                                // Decode it as "from moduleName import *
                                return `from ${moduleName} import *`;
                            } else if (nextOpCode.OpCodeID == OpCodes.IMPORT_FROM) {
                                // Decode it as "from moduleName import '*' | (name as asname,)*
                                let names = obj.Consts.Value[code.PeekPrevInstruction().Argument];
                                nextOpCode = code.GetNextInstruction();

                                if (names.ClassName == "Py_Tuple") {
                                    let output = `from ${moduleName} import `;

                                    let pairs = [];
                                    for (let idx = 0; idx < names.length; idx++) {
                                        let name = names.Value[idx].toString();
                                        let asName = PycDecompiler.Identifier(obj, code, DataStack);
                                        code.GetNextInstruction();

                                        if (asName && name != asName) {
                                            pairs.push(`${name} as ${asName}`);
                                        } else {
                                            pairs.push(name);
                                        }
                                    }
                                    output += pairs.join(", ");
                                    return output;
                                } else {
                                    let name = PycDecompiler.Expr(obj, code, DataStack, code.GetOffsetByOpCodeName("STORE_") + 3);

                                    if (names != name) {
                                        code.GetNextInstruction();
                                        return `from ${moduleName} import ${names} as ${name}`;
                                    } else {
                                        code.GetNextInstruction();
                                        return `from ${moduleName} import ${names}`;
                                    }
                                }
                            } else {
                                // Decode it as import moduleName
                                if (nextOpCode.OpCodeID == OpCodes.LOAD_ATTR) {
                                    code.SkipInstruction();
                                }

                                let name = PycDecompiler.Identifier(obj, code, DataStack);
                                
                                if (name != moduleName) {
                                    return `import ${moduleName} as ${name}`;
                                } else {
                                    return `import ${moduleName}`;
                                }
                            }
                        }
                    case OpCodes.IMPORT_FROM:
                        break;
                    case OpCodes.JUMP_FORWARD:
                        return ""; //code.MoveBack();
                    case OpCodes.JUMP_IF_FALSE_OR_POP:
                    case OpCodes.JUMP_IF_TRUE_OR_POP:
                        {
                            let jumpTarget = code.Current.JumpTarget;
                            let targetIdx = code.GetIndexByOffset(jumpTarget);
                            let resultlet = DataStack.pop();
                            let ifsOffs = [];

                            for (let idx = code.CurrentInstructionIndex + 1; idx < targetIdx; idx++) {
                                let peekOp = code.PeekInstructionAt(idx);
                                
                                if (peekOp.OpCodeID == OpCodes.JUMP_IF_FALSE_OR_POP ||
                                    peekOp.OpCodeID == OpCodes.JUMP_IF_TRUE_OR_POP) {
                                    ifsOffs.push(peekOp.Offset);
                                }
                            }

                            if (code.Current.OpCodeID == OpCodes.JUMP_IF_FALSE_OR_POP) {
                                resultlet += " and ";
                            } else {
                                resultlet += " or ";
                            }


                            for (let offset of ifsOffs) {
                                resultlet += PycDecompiler.Expr(obj, code, DataStack, offset);
                                code.GetNextInstruction();

                                if (code.Current.OpCodeID == OpCodes.JUMP_IF_FALSE_OR_POP) {
                                    resultlet += " and ";
                                } else {
                                    resultlet += " or ";
                                }
                            }

                            let jumpForward = code.GetOffsetByOpCode(OpCodes.JUMP_FORWARD);

                            if (jumpForward < jumpTarget &&
                                code.PeekInstructionAtOffset(jumpForward + 3).OpCodeID == OpCodes.ROT_TWO &&
                                code.PeekInstructionAtOffset(jumpForward + 4).OpCodeID == OpCodes.POP_TOP) {
                                resultlet += PycDecompiler.Expr(obj, code, DataStack, jumpForward);
                                code.SkipInstruction(3);
                            } else {
                                resultlet += PycDecompiler.Expr(obj, code, DataStack, jumpTarget);
                            }

                            DataStack.push(resultlet);
                            break;
                        }
                    case OpCodes.JUMP_ABSOLUTE:
                        break;
                    case OpCodes.POP_JUMP_IF_FALSE:
                        {
                            let result = new PycResult();
                            PycDecompiler.DecompileIfExpression(obj, code, DataStack, result);
                            if (result.HasResult) {
                                return result.toString();
                            }
                        }
                        break;
                    case OpCodes.POP_JUMP_IF_TRUE:
                        return code.MoveBack();
                    case OpCodes.LOAD_GLOBAL:
                        DataStack.push(code.Current.Name);
                        break;
                    case OpCodes.CONTINUE_LOOP:
                        // TODO: Do I have to pop stuff from stack?
                        return "continue";
                    case OpCodes.SETUP_LOOP:
                        return code.MoveBack(); // Handled in Stmts
                    case OpCodes.SETUP_EXCEPT:
                        return code.MoveBack(); // Handled in Stmts
                    case OpCodes.SETUP_FINALLY:
                        return code.MoveBack(); // Handled in Stmts
                    case OpCodes.LOAD_FAST:
                        DataStack.push(code.Current.LocalName);
                        break;
                    case OpCodes.STORE_FAST:
                        {
                            if (DataStack.length == 0 || code.PeekPrevInstruction().OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.LocalName;
                            }

                            let expr = code.Current.LocalName + " = " + DataStack.pop();

                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.DELETE_FAST:
                        return "del " + code.Current.LocalName;
                    case OpCodes.RAISE_VARARGS:
                        {
                            let raiseValue = "";
                            
                            if (code.Current.Argument == 3) {
                                raiseValue = "," + DataStack.pop();
                            }

                            if (code.Current.Argument >= 2) {
                                raiseValue = "," + DataStack.pop() + raiseValue;
                            }

                            if (code.Current.Argument >= 1) {
                                raiseValue = DataStack.pop() + raiseValue;
                            }

                            return "raise " + raiseValue;
                        }
                    case OpCodes.CALL_FUNCTION:
                    case OpCodes.CALL_FUNCTION_VAR:
                    case OpCodes.CALL_FUNCTION_KW:
                    case OpCodes.CALL_FUNCTION_VAR_KW:
                        {
                            let na = code.Current.Argument & 0xFF;
                            let nk = (code.Current.Argument >> 8) & 0xFF;
                            let n = na + nk * 2;

                            let flags = code.Current.OpCodeID - OpCodes.CALL_FUNCTION;
                            
                            // if CALL_FLAG_VAR
                            if (flags & 1) {
                                n++;
                            }
                            
                            // if CALL_FLAG_KW
                            if (flags & 2) {
                                n++;
                            }

                            if (n > DataStack.length) {
                                throw new Error(`ERROR: ${code.Current.InstructionName} expects ${n} params that bigger than stack size ${DataStack.length}`);
                            }

                            let pars = [];
                            
                            for (let i = 0; i < nk; i++) {
                                let value = DataStack.pop();
                                let key  = DataStack.pop();
                                pars.push(key.replace(/\'/g, '') + " = " + value);
                            }

                            for (let i = 0; i < na; i++) {
                                pars.unshift(DataStack.pop());
                            }

                            // if CALL_FLAG_VAR
                            if (flags & 1) {
                                pars.push(`*${DataStack.pop()}`);
                            }
                            
                            // if CALL_FLAG_KW
                            if (flags & 2) {
                                pars.push(`**${DataStack.pop()}`);
                            }

                            let functionName = DataStack.pop();
                            DataStack.push(`${functionName}(${pars.join(", ")})`);
                            break;
                        }
                    case OpCodes.MAKE_FUNCTION:
                        return code.MoveBack(); // Handled in Stmts
                    case OpCodes.BUILD_SLICE:
                        {
                            let step = "";
                            if (code.Current.Argument == 3) {
                                step = DataStack.pop();
                            }

                            let endIndex = DataStack.pop();
                            let startIndex = DataStack.pop();

                            if (step == "None") {
                                step = "";
                            }
                            if (endIndex == "None") {
                                endIndex = "";
                            }

                            if (startIndex == "None") {
                                startIndex = "";
                            }

                            if (code.Current.Argument == 3) {
                                DataStack.push(`${startIndex}:${endIndex}:${step}`);
                            } else {
                                DataStack.push(`${startIndex}:${endIndex}`);
                            }
                        }
                        break;
                    case OpCodes.MAKE_CLOSURE:
                        return code.MoveBack();
                    case OpCodes.LOAD_CLOSURE:
                        DataStack.push(code.Current.FreeName);
                        break;
                    case OpCodes.LOAD_DEREF:
                        DataStack.push(code.Current.FreeName);
                        break;
                    case OpCodes.STORE_DEREF:
                        {
                            if (DataStack.length == 0 || code.PeekPrevInstruction().OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.FreeName;
                            }

                            let expr = code.Current.FreeName + " = " + DataStack.pop();

                            if (code.PeekNextInstruction().OpCodeID == OpCodes.DUP_TOP) {
                                code.SkipInstruction();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.SETUP_WITH:
                        return "";
                    case OpCodes.EXTENDED_ARG:
                        return "";
                    case OpCodes.SET_ADD:
                        return "";
                    case OpCodes.MAP_ADD:
                        return "";
                    default:
                        return code.MoveBack();
                }
            }
            catch (ex)
            {
                return `EXCEPTION for OpCode ${code.Current.InstructionName} (${code.Current.Argument}) at offset ${code.Current.Offset} : ${ex.Message}\n\n`;
            }
        }

        return "";
    }

    // TODO
    static RecreateComprehensionGenerator(code, genCount, currentIndex = 0, isCompFunc = true) {
        if (isCompFunc)
        {
            if (currentIndex == 0)
            {

            }
            else
            {
            }
        }
        return "";
    }

    static Identifier(obj, code, DataStack) {
        if (obj == null) {
            return "";
        }

        while (code.HasInstructionsToProcess) {
            try {
                code.GetNextInstruction();
                let v1 = "", v2 = "", v3 = "";

                switch (code.Current.OpCodeID) {
                    case OpCodes.BINARY_SUBSCR:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        v1 = v2 + "[" + v1 + "]";
                        return v1;
                    case OpCodes.SLICE:
                        v1 = DataStack.pop();
                        v1 = v1 + "[:]";
                        return v1;
                    case OpCodes.SLICE1:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        v1 = v2 + "[" + v1 + ":]";
                        return v1;
                    case OpCodes.SLICE2:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        v1 = v2 + "[:" + v1 + "]";
                        return v1;
                    case OpCodes.SLICE3:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        v3 = DataStack.pop();
                        v1 = v3 + "[" + v1 + ":" + v2 + "]";
                        return v1;
                    case OpCodes.STORE_SLICE:
                        v1 = DataStack.pop();
                        return v1 + "[:]";
                    case OpCodes.STORE_SLICE1:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        return v2 + "[" + v1 + ":]";
                    case OpCodes.STORE_SLICE2:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        return v2 + "[:" + v1 + "]";
                    case OpCodes.STORE_SLICE3:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        v3 = DataStack.pop();
                        return v3 + "[" + v1 + ":" + v2 + "]";
                    case OpCodes.STORE_SUBSCR:
                        v1 = DataStack.pop();
                        v2 = DataStack.pop();
                        return v2 + "[" + v1 + "]";
                    case OpCodes.STORE_NAME:
                        return code.Current.Name;
                    case OpCodes.STORE_ATTR:
                        v1 = DataStack.pop();
                        return v1 + "." + code.Current.Name;
                    case OpCodes.STORE_GLOBAL:
                        return code.Current.Name;
                    case OpCodes.LOAD_CONST:
                        DataStack.push(code.Current.Constant);
                        break;
                    case OpCodes.LOAD_NAME:
                        DataStack.push(code.Current.Name);
                        break;
                    case OpCodes.LOAD_ATTR:
                        v1 = DataStack.pop();
                        v1 = v1 + "." + code.Current.Name;
                        DataStack.push(v1);
                        break;
                    case OpCodes.LOAD_GLOBAL:
                        DataStack.push(code.Current.Name);
                        break;
                    case OpCodes.LOAD_FAST:
                        DataStack.push(code.Current.LocalName);
                        break;
                    case OpCodes.STORE_FAST:
                        return code.Current.LocalName;
                    case OpCodes.BUILD_SLICE:
                        if (code.Current.Argument == 3)
                            v3 = DataStack.pop();
                        v2 = DataStack.pop();
                        v1 = DataStack.pop();

                        if (v3 == "None") {
                            v3 = "";
                        }

                        if (v2 == "None") {
                            v2 = "";
                        }

                        if (v1 == "None") {
                            v1 = "";
                        }

                        if (code.Current.Argument == 3) {
                            DataStack.push([v1, v2, v3].join(":"));
                        } else {
                            DataStack.push([v1, v2].join(":"));
                        }
                        break;
                    case OpCodes.LOAD_CLOSURE:
                        DataStack.push(code.Current.FreeName);
                        break;
                    case OpCodes.LOAD_DEREF:
                        DataStack.push(code.Current.FreeName);
                        break;
                    case OpCodes.STORE_DEREF:
                        return code.Current.FreeName;
                    default:
                        return DataStack.pop();
                }
            }
            catch (ex)
            {
                return `EXCEPTION for OpCode ${code.Current.InstructionName} (${code.Current.Argument}) at offset ${code.Current.Offset} : ${ex.Message}\n\n`;
            }
        }

        return DataStack.pop();
    }
}

module.exports = PycDecompiler;