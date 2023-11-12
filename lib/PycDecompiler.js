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
        if (funcBody.toString().length > 0) {
            return funcBody;
        }

        return "pass";
    }


    static Stmts (obj, code, DataStack, endOffset = 0) {
        let nextOpCode = null;

        if (obj == null) {
            return null;
        }

        let result = new PycResult(null);

        while (code.HasInstructionsToProcess) {
            try {
                if (endOffset > 0) {
                    if (code.Next.Offset >= endOffset) {
                        if (DataStack.length > 0 && !result.HasResult) {
                            result.Add(DataStack.pop());
                        }
                        return result;
                    }
                }
                
                code.GoNext();

                switch (code.Current.OpCodeID)
                {
                    case OpCodes.WITH_CLEANUP:
                        break;
                    case OpCodes.LOAD_LOCALS:
                        break;
                    case OpCodes.UNPACK_SEQUENCE:
                        return PycDecompiler.UnpackSequence(obj, code, DataStack);
                    case OpCodes.POP_BLOCK:
                        break;
                    case OpCodes.JUMP_FORWARD:
                        break;
                    case OpCodes.JUMP_ABSOLUTE:
                        if (code.Next.InstructionName.startsWith("JUMP_")) {
                            result.Add("continue");
                        }
                        break;
                    case OpCodes.POP_JUMP_IF_FALSE:
                        PycDecompiler.DecompileIfExpression(obj, code, DataStack, endOffset, result);
                        break;
                    case OpCodes.POP_JUMP_IF_TRUE:
                        // Used in case: assert: expr POP_JUMP_IF_TRUE LOAD_GLOBAL RAISE_VARARGS(1,2)
                        // In case of peephole optimizer it can be the case of optimisation of 
                        // 'if not <expression>' so it should be decoded in DecompileIfExpression
                        nextOpCode = code.Next;
                        let raiseOffset = code.GetOffsetByOpCode(OpCodes.RAISE_VARARGS, -1, code.Current.JumpTarget);
                        /// TODO: commented for now as it is unlikely to get assert in optimized code
                        /// will revisit later
                        // if (raiseOffset > 0 && DataStack) {
                        //     let testCondition = DataStack.pop();
                        //     let raiseOp = code.PeekInstructionAtOffset(raiseOffset);
                        //     let msg = null;
                        //     if (raiseOp.Argument == 2) {
                        //         msg = PycDecompiler.Expr(obj, code, DataStack, raiseOffset);
                        //         result.Add("assert " + testCondition + (msg == "" ? "" : ", ") + msg);
                        //     }
                        // } else {
                            PycDecompiler.DecompileIfExpression(obj, code, DataStack, endOffset, result);
                        // }
                        break;
                    case OpCodes.SETUP_LOOP:
                        let jumpTarget = code.Current.JumpTarget;
                        let forOffset = -1, 
                            getIterOffset = -1,
                            jumpOffset = -1,
                            inclusiveLoopOffset = -1;

                        forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER, -1, jumpTarget);
                        inclusiveLoopOffset = code.GetOffsetByOpCode(OpCodes.SETUP_LOOP, -1, jumpTarget);
                        forOffset = forOffset < jumpTarget ? forOffset : -1;
                        getIterOffset = code.GetOffsetByOpCode(OpCodes.GET_ITER, -1, jumpTarget);
                        getIterOffset = getIterOffset < jumpTarget ? getIterOffset : -1;
                        
                        if (forOffset > 0) {
                            nextOpCode = code.PeekInstructionAtOffset(forOffset);
                            jumpOffset = nextOpCode.JumpTarget;
                        } else {
                            // TODO: Figure out cases when it can be wrong
                            jumpOffset = code.GetOffsetByOpCode(OpCodes.JUMP_ABSOLUTE, -1, jumpTarget);
                            if (jumpOffset > jumpTarget || (jumpTarget - jumpOffset) > 4) {
                                jumpOffset = jumpTarget;
                            }
                        }

                        if (forOffset >= 0 &&
                            ((inclusiveLoopOffset > 0 && forOffset < inclusiveLoopOffset) ||
                            (inclusiveLoopOffset == -1)) &&
                            forOffset < jumpOffset && jumpOffset < jumpTarget) {
                            let inExpr = PycDecompiler.Expr(obj, code, DataStack, getIterOffset);
                            code.GoNext(2);
                            let forJump = code.Current.JumpTarget;
                            let forExpr = PycDecompiler.Expr(obj, code, DataStack);
                            result.Add("for " + forExpr + " in " + inExpr + ":");
                            let forBody = PycDecompiler.Stmts(obj, code, DataStack, forJump);
                            result.Add(forBody);

                            if (forJump < jumpTarget) {
                                code.GoNext();
                                if (code.Current.Argument > 0) {
                                    let elseBody = PycDecompiler.Stmts(obj, code, DataStack, jumpTarget);
                                    if (elseBody.HasResult) {
                                        result.Add("else:");
                                        result.Add(elseBody);
                                    }
                                }
                            }
                        } else {
                            let ifOffset = code.GetOffsetByOpCodeName("POP_JUMP_IF_", -1, jumpTarget);
                            let elseOffset = 0;
                            let testCondition = "";
                            let testConditionExtra = "";
                            let ifOp = code.PeekInstructionAtOffset(ifOffset);
                            let ifOpLine = obj.LineNoTab[ifOp.Offset];
                            let whileLine = obj.LineNoTab[code.Current.Offset];

                            if (ifOpLine == whileLine) {
                                testCondition = PycDecompiler.Expr(obj, code, DataStack, ifOffset);
                                // Skipping POP_JUMP_IF_ command as we need only test condition for it
                                code.GoNext();
                                [testConditionExtra, jumpOffset] = PycDecompiler.ExtractTestCondition(obj, code, DataStack, jumpOffset);
                                if (testConditionExtra != "") {
                                    testCondition + testConditionExtra;
                                }
                                elseOffset = code.PeekInstructionBeforeOffset(ifOp.JumpTarget).Offset;
                            } else {
                                testCondition = "True";
                            }
                            result.Add("while " + testCondition + ":");
                            let whileBody = PycDecompiler.Stmts(obj, code, DataStack, jumpOffset);
                            result.Add(whileBody);
                            code.GoNext();
                            if (code.Current.Offset < jumpTarget) {
                                let elseBody = PycDecompiler.Stmts(obj, code, DataStack, jumpTarget);
                                if (elseBody.HasResult) {
                                    result.Add("else:");
                                    result.Add(elseBody);
                                }
                            } else {
                                code.MoveBack();
                            }
                        }
                        break;
                    case OpCodes.SETUP_EXCEPT:
                        {
                            result.Add("try:");
                            let tryOffset = code.Current.Offset;
                            let exceptBlockOffset = code.Current.JumpTarget;
                            let orElseOffset = code.PeekInstructionAtOffset(exceptBlockOffset - 3)?.JumpTarget || 0;
                            if (orElseOffset < code.Current.Offset) {
                                orElseOffset = code.LastOffset;
                            }
                            let finallyOffset = code.GetReversedOffsetByOpCode(OpCodes.END_FINALLY, orElseOffset, code.Current.Offset);
                            if (orElseOffset == code.LastOffset) {
                                orElseOffset = finallyOffset;
                            }
                            let endOffset = 0;
                            if (finallyOffset > 0) {
                                endOffset = code.PeekInstructionAtOffset(finallyOffset - 3)?.JumpTarget || 0;
                            }

                            if (endOffset < tryOffset) {
                                endOffset = finallyOffset + 1;
                            }

                            //TODO: Modify jumpTarget - 4 code
                            let bodyStmt = PycDecompiler.Stmts(obj, code, DataStack, exceptBlockOffset - 4);
                            result.Add(bodyStmt);
                            // if (code.Current.OpCodeID == OpCodes.POP_TOP) {
                            //     code.GoNext();
                            // }
                            code.GoNext(2); // POP_BLOCK and jump to else block;

                            while (true) {
                                let exceptionOffset = 0;
                                let exceptHandlerType = null;
                                let varName = null;
                            
                                if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                    // except handler type
                                    code.GoNext();
                                    exceptHandlerType = PycDecompiler.Expr(obj, code, DataStack, code.GetOffsetByOpCode(OpCodes.COMPARE_OP, -1, orElseOffset));
                                    exceptionOffset = code.GetNextInstruction(2).Argument;
                                }

                                code.GoNext();
                                nextOpCode = code.Next;
                                
                                if (nextOpCode.OpCodeID != OpCodes.POP_TOP) {
                                    varName = PycDecompiler.Expr(obj, code, DataStack, code.GetOffsetByOpCode(OpCodes.POP_TOP, -1, orElseOffset));
                                } else {
                                    code.GoNext();
                                }

                                code.GoNext();
                                let excBody = null;
                                
                                endOffset = (endOffset == 0) ? orElseOffset : endOffset;
                                excBody = PycDecompiler.Stmts(obj, code, DataStack, exceptionOffset == 0 ? orElseOffset : exceptionOffset);

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
                                    result.Add("    pass");
                                }

                                if (exceptionOffset == 0) {
                                    break;
                                }

                                if (code.PeekInstructionAtOffset(exceptionOffset).OpCodeID == OpCodes.END_FINALLY) {
                                    code.GoToOffset(exceptionOffset); // after END_FINALLY
                                    break;
                                }
                            }
                            if (orElseOffset + 1 < endOffset) {
                                let elseBody = PycDecompiler.Stmts(obj, code, DataStack, endOffset);
                                if (elseBody.HasResult) {
                                    result.Add("else:");
                                    result.Add(elseBody);
                                }
                            }
                        }
                        break;
                    case OpCodes.SETUP_FINALLY:
                        let beginTryFinallyLine = obj.LineNoTab[code.Current.Offset];
                        let isTryExceptFinally = code.Next.OpCodeID == OpCodes.SETUP_EXCEPT && obj.LineNoTab[code.Next.Offset] == beginTryFinallyLine;
                        let finallyBodyAddress = code.Current.JumpTarget;
                        // TODO: Re-do finallyBodyAddress - 4
                        let bodyStmts = PycDecompiler.Stmts(obj, code, DataStack, finallyBodyAddress - 4);
                        code.GoNext(2);
                        let endFinallyAddress = code.GetOffsetByOpCode(OpCodes.END_FINALLY, finallyBodyAddress);
                        let finallyBodyStmts = PycDecompiler.Stmts(obj, code, DataStack, endFinallyAddress);
                        if (isTryExceptFinally) {
                            bodyStmts.DoNotIndent = true;
                        } else {
                            result.Add("try:");
                        }
                        result.Add(bodyStmts);
                        result.Add("finally:");
                        result.Add(finallyBodyStmts);
                        break;
                    case OpCodes.MAKE_FUNCTION:
                    case OpCodes.MAKE_CLOSURE:
                        PycDecompiler.MakeFunction(obj, code, DataStack, result);
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
                        
                        code.GoNext();
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
                result.Add(`EXCEPTION for OpCode ${code.Current.InstructionName} (${code.Current.Argument}) at offset ${code.Current.Offset} : ${ex}\n\n`);
            }
        }
        return result;
    }

    static MakeFunction(obj, code, DataStack, result) {
        let const_idx = +DataStack.pop();
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

            default_params.reverse();
        }

        if (child_co.Name == "<lambda>") {
            PycDecompiler.MakeLambda(child_co, DataStack, default_params);
            return;
        }

        child_co.SourceCode = PycDecompiler.Decompile(child_co);
        if (!child_co.SourceCode) {
            child_co.SourceCode = new PycResult("pass");
        }
        let childFuncName = child_co.Name[0] == '<' ? `${child_co.Name}_${const_idx}` : child_co.Name;
        obj.Methods[childFuncName] = child_co;
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
        let nextOpCode = code.Next;
        if (nextOpCode.InstructionName == "CALL_FUNCTION" && nextOpCode.Argument == 0 && code.PeekNextInstruction(2).OpCodeID == OpCodes.BUILD_CLASS) {
            code.GoNext();
            return;
        } else if (nextOpCode.OpCodeID == OpCodes.CALL_FUNCTION && nextOpCode.Argument == 1) {
            while (nextOpCode.OpCodeID == OpCodes.CALL_FUNCTION && nextOpCode.Argument == 1) {
                code.GoNext();
                let  functionDecorator = "";
                if (DataStack.length > 0) {
                    functionDecorator = DataStack.pop();
                }

                child_co.FuncDecos.Add("@" + functionDecorator);
                nextOpCode = code.Next;
            }
        } else if (child_co.FuncName[0] != "<" && code.Prev.InstructionName.startsWith("LOAD_") && DataStack.length > 0) {
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
                let param = child_co.VarNames.Value[idx];
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

    static DecompileIfExpression(obj, code, DataStack, parentEndOffset, result) {
        parentEndOffset ||= code.LastOffset;
        let elseOffset = parentEndOffset <= 0 ? code.Current.JumpTarget : code.Current.JumpTarget < parentEndOffset ? code.Current.JumpTarget : parentEndOffset;
        let [dominatorEndOffset, dominatorOp] = code.FindEndOfBlock(code.Current.JumpTarget);
        let testLine = obj.LineNoTab[code.Current.Offset];
        let opIndex = code.GetIndexByOffset(elseOffset);
        let jumpOpcode = code.PeekInstructionAt(opIndex - 1);
        let endOffset = (jumpOpcode.OpCodeID == OpCodes.JUMP_FORWARD && jumpOpcode.Argument > 0) ? jumpOpcode.JumpTarget : parentEndOffset;
        if (elseOffset < code.Current.Offset && dominatorOp?.OpCodeID == OpCodes.SETUP_LOOP) {
            endOffset = endOffset < dominatorEndOffset ? endOffset : dominatorEndOffset;
        }
        let elseLine = elseOffset < endOffset ? obj.LineNoTab[elseOffset] : 0;
        let ifTest = "", ifTestPart = "";
        let ifBody = null;
        let ifElseBody = null;

        let isIfNotExp = code.Current.OpCodeID == OpCodes.POP_JUMP_IF_TRUE;

        ifTest = (isIfNotExp ? 'not ' : '') + DataStack.pop();

        [ifTestPart, elseOffset] = PycDecompiler.ExtractTestCondition(obj, code, DataStack, elseOffset);
        ifTest += ifTestPart;

        let bodyLine = obj.LineNoTab[code.Next.Offset];
        ifBody = PycDecompiler.Stmts(obj, code, DataStack, elseOffset);

        if (!ifBody.HasResult) {
            ifBody.Add("continue");
        }
        
        if (code.Current.OpCodeID == OpCodes.JUMP_FORWARD) {
            if (code.Current.Offset < elseOffset && code.Current.Argument > 0) {
                // let jumpTarget = code.Current.JumpTarget;
                ifElseBody = PycDecompiler.Stmts(obj, code, DataStack, endOffset);
            }
        }

        if (testLine == bodyLine && bodyLine == elseLine && ifElseBody?.HasResult) {
            DataStack.push(ifBody.Result[0] + " if " + ifTest + " else " + ifElseBody.Result[0]);
        } else {
            if (testLine == bodyLine && ifBody.Result.length == 1) {
                result.Add("if " + ifTest + ": " + ifBody.Result[0]);
            } else {
                result.Add("if " + ifTest + ":");
                result.Add(ifBody);
            }

            if (ifElseBody != null && ifElseBody.HasResult) {
                result.Add("else:");
                result.Add(ifElseBody);
            }
        }
    }

    static FindIfCodesWithTheSameTarget(obj, code, offset = -1, endOffset = -1) {
        let startPos = offset == -1 ? code.CurrentInstructionIndex : code.GetIndexByOffset(offset);
        let endPos = endOffset < 1 ? code.Instructions.length - 1 : code.GetIndexByOffset(endOffset);
        let commonTarget = -1;
        let result = [];
        let prevOffset = 0;

        for (let position = startPos; position <= endPos; position++) {
            let currentOp = code.Instructions[position];
            if ([OpCodes.POP_JUMP_IF_FALSE, OpCodes.POP_JUMP_IF_TRUE, OpCodes.JUMP_IF_FALSE_OR_POP, OpCodes.JUMP_IF_TRUE_OR_POP].includes(currentOp.OpCodeID)) {
                if (commonTarget < 0) {
                    commonTarget = currentOp.JumpTarget;
                    prevOffset = currentOp.Offset;
                } else if (currentOp.JumpTarget != commonTarget || obj.LineNoTab[prevOffset] != obj.LineNoTab[currentOp.Offset]) {
                    break;
                }
                result.push(currentOp.Offset);
            }
        }

        return result;

    }

    static ExtractTestCondition(obj, code, DataStack, endOffset) {
        endOffset ||= code.LastOffset;
        let ifTest = "";
        let [jumpOffset, _] = code.FindEndOfBlock(endOffset);

        let ifOffests = PycDecompiler.FindIfCodesWithTheSameTarget(obj, code, code.Current.Offset, endOffset);
        if ( ifOffests.length > 1 && code.Current.Offset < endOffset) {
            if (code.Current.Offset == ifOffests[0]) {
                ifOffests.shift();
            }
            for (let ifOffset of ifOffests) {
                let op = "";
                if ([OpCodes.JUMP_IF_FALSE_OR_POP, OpCodes.POP_JUMP_IF_FALSE].includes(code.Current.OpCodeID))
                    op = " and ";
                else if ([OpCodes.JUMP_IF_TRUE_OR_POP, OpCodes.POP_JUMP_IF_TRUE].includes(code.Current.OpCodeID))
                    op = " or ";
                let temp = PycDecompiler.Expr(obj, code, DataStack, ifOffset);
                if (temp == "")
                {
                    temp = DataStack.pop();
                }
                ifTest += op + temp;
                code.GoNext();
                jumpOffset = code.Current.JumpTarget;
            }
        }

        return [ifTest, jumpOffset];
    }

    static DecompileComprehension(obj, code, DataStack, endOffset){
        let
            forOffset = -1,
            getIterOffset = -1,
            jumpOffset = -1,
            nextOpCode = null,
            comp_for = "";

    
        forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER, -1, endOffset);
        getIterOffset = code.GetOffsetByOpCode(OpCodes.GET_ITER, -1, endOffset);
        if (getIterOffset == -1) {
            getIterOffset = forOffset;
        }

        if (forOffset > 0) {
            nextOpCode = code.PeekInstructionAtOffset(forOffset);
            jumpOffset = nextOpCode.JumpTarget - 3;
        } else {
            // TODO: Figure out cases when it can be wrong
            jumpOffset = code.GetOffsetByOpCode(OpCodes.JUMP_ABSOLUTE);
        }

        if (forOffset >= 0 && forOffset < jumpOffset) {
            let iter = PycDecompiler.Expr(obj, code, DataStack, getIterOffset);
            code.GoNext( forOffset > getIterOffset ? 2 : 1);
            let target = PycDecompiler.Expr(obj, code, DataStack, jumpOffset);
            comp_for = ` for ${target} in ${iter}`;
        }
        let ifOffset = code.GetOffsetByOpCode(OpCodes.POP_JUMP_IF_FALSE, -1, endOffset);
        let ifExpr = "";
        if (ifOffset >= 0 && ifOffset <= jumpOffset) {
            ifExpr = " if " + PycDecompiler.ExtractTestCondition(obj, code, DataStack, endOffset)[0];
        }

        let expr = null, lbracket = "", rbracket = "";
        let listAppendOffset = code.GetOffsetByOpCode(OpCodes.LIST_APPEND, -1, endOffset);
        let setAddOffset = code.GetOffsetByOpCode(OpCodes.SET_ADD, -1, endOffset);
        let mapAddOffset = code.GetOffsetByOpCode(OpCodes.MAP_ADD, -1, endOffset);
        
        if (listAppendOffset > -1) {
            lbracket = '[';
            rbracket = ']';
            expr = PycDecompiler.Expr(obj, code, DataStack, listAppendOffset);
            code.GoNext(2);
        } else if (setAddOffset > -1) {
            lbracket = '{';
            rbracket = '}';
            expr = PycDecompiler.Expr(obj, code, DataStack, setAddOffset);
            code.GoNext();
        } else if (mapAddOffset > -1) {
            lbracket = '{';
            rbracket = '}';
            let key = PycDecompiler.Expr(obj, code, DataStack, mapAddOffset);
            let value = PycDecompiler.Expr(obj, code, DataStack, mapAddOffset);
            expr = `${key}: ${value}`;
            code.GoNext(2);
        }

        let list_comp = lbracket + expr + comp_for + ifExpr + rbracket;
        DataStack.push(list_comp);
    }

    static Expr (obj, code, DataStack, endOffset = 0) {
        if (obj == null || endOffset == -1) {
            return "";
        }

        let nextOpCode = null, prevOpCode = null;

        while (code.HasInstructionsToProcess) {
            try {
                if (endOffset > 0) {
                    if (code.Next.Offset >= endOffset) {
                        if (DataStack.length > 0) {
                            return DataStack.pop();
                        } else {
                            return "";
                        }
                    }
                }
                code.GoNext();

                switch (code.Current.OpCodeID) {
                    case OpCodes.POP_TOP:
                        if (DataStack.length > 0)
                            return DataStack.pop();
                        return "";
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
                            value = value[0] == '-' ? value.substring(1) : value;
                            DataStack.push(value);
                        }
                        break;
                    case OpCodes.UNARY_NEGATIVE:
                        {
                            let value = DataStack.pop();
                            value = value[0] == '-' ? value : '-' + value;
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " //= " + rVal;
                            } else {
                                DataStack.push(lVal + " // " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " /= " + rVal;
                            } else {
                                DataStack.push(lVal + " / " + rVal);
                            }
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
                            let endIndex = DataStack.pop();
                            let startIndex = DataStack.pop();
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
                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
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
                            
                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
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
                            
                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.STORE_SLICE3:
                        {
                            let endIndex = DataStack.pop();
                            let startIndex = DataStack.pop();
                            let name = DataStack.pop();

                            if (DataStack.length > 0) {
                                return name + "[" + startIndex + ":" + endIndex + "]";
                            }

                            let value = DataStack.pop();
                            let expr = name + "[" + startIndex + ":" + endIndex + ":] = " + value;
                            
                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
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
                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " += " + rVal;
                            } else {
                                DataStack.push(lVal + " + " + rVal);
                            }
                        }
                        break;
                    case OpCodes.INPLACE_SUBTRACT:
                        {
                            let rVal = DataStack.pop();
                            let lVal = DataStack.pop();
                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " -= " + rVal;
                            } else {
                                DataStack.push(lVal + " - " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " *= " + rVal;
                            } else {
                                DataStack.push(lVal + " * " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " /= " + rVal;
                            } else {
                                DataStack.push(lVal + " / " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " %= " + rVal;
                            } else {
                                DataStack.push(lVal + " % " + rVal);
                            }
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

                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " **= " + rVal;
                            } else {
                                DataStack.push(lVal + " ** " + rVal);
                            }
                        }
                        break;
                    case OpCodes.GET_ITER:
                        // TODO: Refactor it. It is very fuzzy
                        if ((DataStack.length > 1 && 
                            code.Next.OpCodeID == OpCodes.CALL_FUNCTION && code.Next.Argument == 1 
                            && code.PeekNextInstruction(2).OpCodeID == OpCodes.CALL_FUNCTION && code.PeekNextInstruction(2).Argument == 1) ||
                            (DataStack.length >= 1 && code.Next.OpCodeID == OpCodes.CALL_FUNCTION && code.Next.Argument == 1))
                        {
                            let iter = DataStack.pop();
                            let makeFunctionOffset = code.GetBackOffsetByOpCodeName("MAKE_");
                            let objectConst = code.PeekInstructionBeforeOffset(makeFunctionOffset);

                            if (objectConst == null) {
                                throw new Error("objectConst is null");
                            }

                            let co = obj.Consts.Value[objectConst.Argument];
                            let source = co.SourceCode.Result[0].replace(".0", iter );

                            code.GoNext(co.FuncName[0] != "<" && DataStack.length > 1 ? 2 : 1);

                            let funcName = "";

                            if (co.FuncName[0] != "<" && DataStack.length > 0) {
                                funcName = DataStack.pop();
                            }

                            if (funcName) {
                                DataStack.push(`${funcName}(${source})`);
                            } else {
                                DataStack.push(source);
                            }
                            break;
                        }
                        return "";
                    case OpCodes.PRINT_EXPR:
                    case OpCodes.PRINT_ITEM:
                        if (code.Next.OpCodeID == OpCodes.PRINT_NEWLINE) {
                            code.GoNext();
                            return `print (${DataStack.pop()})`;
                        } else {
                            return `print (${DataStack.pop()},)`;
                        }
                    case OpCodes.PRINT_NEWLINE:
                        break;
                    case OpCodes.PRINT_ITEM_TO:
                        {
                            let separator = "";
                            if (code.Next.OpCodeID == OpCodes.PRINT_NEWLINE_TO) {
                                separator = ",";
                            }

                            let printStmt = "print >> " + DataStack.pop() + ", " + DataStack.pop() + separator;
                            
                            if (code.Next.OpCodeID == OpCodes.PRINT_NEWLINE_TO) {
                                code.GoNext();
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " <<= " + rVal;
                            } else {
                                DataStack.push(lVal + " << " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " >>= " + rVal;
                            } else {
                                DataStack.push(lVal + " >> " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " &= " + rVal;
                            } else {
                                DataStack.push(lVal + " & " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " ^= " + rVal;
                            } else {
                                DataStack.push(lVal + " ^ " + rVal);
                            }
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

                            let nextOp = code.Next;
                            if (nextOp.OpCodeID == OpCodes.STORE_FAST && nextOp.LocalName == lVal) {
                                code.GoNext();
                                return lVal + " |= " + rVal;
                            } else {
                                DataStack.push(lVal + " | " + rVal);
                            }
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
                                    if (DataStack[DataStack.length - 1].endsWith(" and ") || DataStack[DataStack.length - 1].endsWith(" or ")) {
                                        expr = DataStack.pop() + expr;
                                    } else {
                                        break;
                                    }
                                }
                            } else if (DataStack.length > 0) {
                                expr = DataStack.pop();
                            } else if (code.Prev.OpCodeID == OpCodes.LOAD_LOCALS) {
                                return "";
                            }

                            if (["<lambda>", "<dictcomp>", "<setcomp>"].includes(obj.Name)) {
                                return expr;
                            }

                            if (code.Current.Offset + 1 < obj.Code.length) {
                                return "return" + (expr == "None" ? "" : " " + expr);
                            } else if (obj.Code.length < 5) {
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
                        return "yield " + DataStack.pop().replace(/^\(/,"").replace(/\)$/, "");
                    case OpCodes.POP_BLOCK:
                        return "";
                    case OpCodes.END_FINALLY:
                        return "";
                    case OpCodes.BUILD_CLASS:
                        return code.MoveBack();
                    case OpCodes.STORE_NAME:
                        {
                            if (DataStack.length == 0 || code.Prev.OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.Name;
                            }

                            let value = DataStack.pop();
                            if (code.Current.Name == "__module__" && value == "__name__") {
                                return "";
                            } else if (code.Current.Name == "__doc__") {
                                return "\"\"\"" + value.replace(/\'/g, '') + "\"\"\"";
                            } else {
                                let expr = code.Current.Name + " = " + value;

                                if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                    code.GoNext();
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
                        return PycDecompiler.UnpackSequence(obj, code, DataStack);
                    case OpCodes.FOR_ITER:
                        let target, ifExpr, yieldExpr;

                        prevOpCode = code.Prev;
                        endOffset = code.Current.JumpTarget;
                        if (prevOpCode.OpCodeID == OpCodes.LOAD_FAST && prevOpCode.Argument == 0) {
                            if (["<genexpr>", "<dictcomp>", "<setcomp>"].includes(obj.Name)) {
                                DataStack.pop();
                                target = PycDecompiler.Identifier(obj, code, DataStack);
                                let getIterOffset = code.GetOffsetByOpCode(OpCodes.GET_ITER, -1, endOffset);
                                let ifOffests = PycDecompiler.FindIfCodesWithTheSameTarget(obj, code, code.Current.Offset, getIterOffset > 0 ? getIterOffset : endOffset);
                                if (ifOffests.length > 0) {
                                    [ifExpr] = PycDecompiler.ExtractTestCondition(obj, code, DataStack, ifOffests.length > 0 ? ifOffests[ifOffests.length - 1] : endOffset);
                                }
                                yieldExpr = "";

                                if (ifExpr?.toString().startsWith("yield ")) {
                                    yieldExpr = ifExpr.toString();
                                    ifExpr = "";
                                } else {
                                    yieldExpr = PycDecompiler.Expr(obj, code, DataStack, endOffset).toString();
                                    if (!yieldExpr && DataStack.length) {
                                        yieldExpr = DataStack.pop();
                                    }
                                }

                                yieldExpr = yieldExpr.replace("yield ", "");

                                /// Questionable: Do we have to remove round brackets around the set values?
                                // if (yieldExpr[0] == '(') {
                                //     yieldExpr = yieldExpr.substring(1,yieldExpr.length - 1);
                                // }

                            } else {
                                DataStack.pop();
                                target = PycDecompiler.Expr(obj, code, DataStack);
                                ifExpr = PycDecompiler.Expr(obj, code, DataStack);
                                code.GoNext();
                                yieldExpr = PycDecompiler.Expr(obj, code, DataStack).replace(/yield /g, "");
                            }
                            code.GoNext(2);
                            let comp = `${yieldExpr} for ${target} in ${prevOpCode.LocalName}`;
                            if (ifExpr) {
                                comp += ` if ${ifExpr}`;
                            }
                            return comp;
                        }
                        return "";
                    case OpCodes.LIST_APPEND:
                        return ""; //code.MoveBack();
                    case OpCodes.STORE_ATTR:
                        {
                            let name = DataStack.pop();
                            if (DataStack.length == 0 || code.Prev.OpCodeID == OpCodes.FOR_ITER) {
                                return name + "." + code.Current.Name;
                            }

                            let value = DataStack.pop();
                            let expr = name + "." + code.Current.Name + " = " + value;
                            
                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
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
                            if (DataStack.length == 0 || code.Prev.OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.Name;
                            }

                            let expr = code.Current.Name + "=" + DataStack.pop();
                            
                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
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
                        let currentOp = code.Current;
                        let constantValue = currentOp.Constant;
                        if (["Py_String", "Py_Unicode"].includes(currentOp.ConstantObject?.ClassName) && !["'","\""].includes(constantValue[0])) {
                            constantValue = `'${constantValue}'`;
                        }
                        DataStack.push(constantValue);
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
                            
                            forOffset = code.GetOffsetByOpCode(OpCodes.FOR_ITER, -1, endOffset);
                            setupLoopOffset = code.GetOffsetByOpCode(OpCodes.SETUP_LOOP, -1, endOffset);
                            if (code.Current.Argument == 0 && (forOffset == -1 || (setupLoopOffset > 0 && forOffset > setupLoopOffset) || (forOffset - code.Current.Offset) > 35)) {
                                    DataStack.push("[]");
                            } else if (code.Current.Argument == 0) {
                                PycDecompiler.DecompileComprehension(obj, code, DataStack, endOffset);
                            } else {
                                let list = `[${DataStack.splice(DataStack.length - code.Current.Argument, code.Current.Argument).join(', ')}]`;
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
                                PycDecompiler.DecompileComprehension(obj, code, DataStack, endOffset);
                            } else {
                                let count = code.Current.Argument;
                                let mapResult = "{";
                                
                                while (count-- > 0) {
                                    let key_value = PycDecompiler.Expr(obj, code, DataStack);
                                    // let key = PycDecompiler.Identifier(obj, code, DataStack);
                                    mapResult += (mapResult == "{" ? " " : ", ") + `${key_value}`;
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
                                PycDecompiler.DecompileComprehension(obj, code, DataStack, endOffset);
                            } else {
                                // let list = [];
                                // for (let i = code.Current.Argument - 1; i >= 0; i--) {
                                //     list.push(DataStack.pop());
                                // }
                                // list.reverse();
                                // let tuple = `(${list.join(", ")})`;
                                let tuple = `(${DataStack.splice(DataStack.length - code.Current.Argument, code.Current.Argument).join(', ')})`;

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
                                PycDecompiler.DecompileComprehension(obj, code, DataStack, endOffset);
                            } else {
                                // let set = "{";

                                // for (let i = 0; i < code.Current.Argument; i++) {
                                //     let value = DataStack.pop();
                                //     set += (set == "{") ? value : ", " + value;
                                // }
                                
                                // set += "}";
                                let set = `{${DataStack.splice(DataStack.length - code.Current.Argument, code.Current.Argument).join(', ')}}`;
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
                            let dots = '';
                            DataStack.pop();
                            let importLevel = ~~DataStack.pop();
                            if (importLevel > 0) {
                                dots = Buffer.alloc(importLevel, '.').toString('ascii');
                            }

                            let moduleName = code.Current.Name;
                            let nextOpCode = code.Next;

                            if (nextOpCode.OpCodeID == OpCodes.IMPORT_STAR) {
                                code.GoNext();
                                // Decode it as "from moduleName import *
                                return `from ${dots}${moduleName} import *`;
                            } else if (nextOpCode.OpCodeID == OpCodes.IMPORT_FROM) {
                                // Decode it as "from moduleName import '*' | (name as asname,)*
                                let names = obj.Consts.Value[code.Prev.Argument];
                                nextOpCode = code.GetNextInstruction();

                                if (names.ClassName == "Py_Tuple") {
                                    let output = `from ${dots}${moduleName} import `;

                                    let pairs = [];
                                    for (let idx = 0; idx < names.length; idx++) {
                                        let name = names.Value[idx].toString();
                                        let asName = PycDecompiler.Identifier(obj, code, DataStack);
                                        code.GoNext();

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
                                        code.GoNext();
                                        return `from ${dots}${moduleName} import ${names} as ${name}`;
                                    } else {
                                        code.GoNext();
                                        return `from ${dots}${moduleName} import ${names}`;
                                    }
                                }
                            } else {
                                // Decode it as import moduleName
                                if (nextOpCode.OpCodeID == OpCodes.LOAD_ATTR) {
                                    code.GoNext();
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
                            let results = DataStack.pop();
                            let ifsOffs = [];

                            for (let idx = code.CurrentInstructionIndex + 1; idx < targetIdx; idx++) {
                                let peekOp = code.PeekInstructionAt(idx);
                                
                                if (peekOp.OpCodeID == OpCodes.JUMP_IF_FALSE_OR_POP ||
                                    peekOp.OpCodeID == OpCodes.JUMP_IF_TRUE_OR_POP) {
                                    ifsOffs.push(peekOp.Offset);
                                }
                            }

                            if (code.Current.OpCodeID == OpCodes.JUMP_IF_FALSE_OR_POP) {
                                results += " and ";
                            } else {
                                results += " or ";
                            }


                            for (let offset of ifsOffs) {
                                results += PycDecompiler.Expr(obj, code, DataStack, offset);
                                code.GoNext();

                                if (code.Current.OpCodeID == OpCodes.JUMP_IF_FALSE_OR_POP) {
                                    results += " and ";
                                } else {
                                    results += " or ";
                                }
                            }

                            let jumpForward = code.GetOffsetByOpCode(OpCodes.JUMP_FORWARD);

                            if (jumpForward > 0 && jumpForward < jumpTarget &&
                                code.PeekInstructionAtOffset(jumpForward + 3).OpCodeID == OpCodes.ROT_TWO &&
                                code.PeekInstructionAtOffset(jumpForward + 4).OpCodeID == OpCodes.POP_TOP) {
                                results += PycDecompiler.Expr(obj, code, DataStack, jumpForward);
                                code.GoNext(3);
                            } else {
                                results += PycDecompiler.Expr(obj, code, DataStack, jumpTarget);
                            }

                            DataStack.push(results);
                            break;
                        }
                    case OpCodes.JUMP_ABSOLUTE:
                        if (code.Next.InstructionName.startsWith("JUMP_")) {
                            return "continue"
                        }
                        break;
                    case OpCodes.POP_JUMP_IF_FALSE:
                        {
                            let result = new PycResult(null);
                            PycDecompiler.DecompileIfExpression(obj, code, DataStack, endOffset, result);
                            result.DoNotIndent = true;
                            return result;
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
                            if (DataStack.length == 0 || code.Prev.OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.LocalName;
                            }

                            let expr = code.Current.LocalName + " = " + DataStack.pop();

                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
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
                            let starred_params = [];

                            // if CALL_FLAG_KW
                            if (flags & 2) {
                                starred_params.unshift(`**${DataStack.pop()}`);
                            }

                            // if CALL_FLAG_VAR
                            if (flags & 1) {
                                starred_params.unshift(`*${DataStack.pop()}`);
                            }
                            
                            
                            for (let i = DataStack.length - nk * 2; i < DataStack.length; i += 2) {
                                let key  = DataStack[i];
                                let value = DataStack[i + 1];
                                pars.push(key.replace(/\'/g, '') + " = " + value);
                            }
                            if (nk > 0) {
                                DataStack.splice(DataStack.length - nk * 2, nk * 2);
                            }

                            for (let i = 0; i < na; i++) {
                                pars.unshift(DataStack.pop());
                            }                            
                            pars = pars.concat(starred_params);
                            let functionName = DataStack.pop();
                            DataStack.push(`${functionName}(${pars.join(", ")})`);
                            break;
                        }
                    case OpCodes.MAKE_FUNCTION:
                        let functionResult = new PycResult();
                        PycDecompiler.MakeFunction(obj, code, DataStack, functionResult);
                        // if (!functionResult.HasResult && DataStack.length > 0) {
                        //     functionResult.Add(DataStack.pop());
                        // }
                        functionResult.DoNotIndent = true;
                        return functionResult;
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
                            if (DataStack.length == 0 || code.Prev.OpCodeID == OpCodes.FOR_ITER) {
                                return code.Current.FreeName;
                            }

                            let expr = code.Current.FreeName + " = " + DataStack.pop();

                            if (code.Next.OpCodeID == OpCodes.DUP_TOP) {
                                code.GoNext();
                                DataStack.push(expr);
                                break;
                            } else {
                                return expr;
                            }
                        }
                    case OpCodes.SETUP_WITH:
                        let result = new PycResult(null);
                        let cond = DataStack.pop();
                        let jumpOffset = code.Current.JumpTarget;
                        let withName = PycDecompiler.Identifier(obj, code, DataStack);
                        let bodyStmts = PycDecompiler.Stmts(obj, code, DataStack, jumpOffset);
                        bodyStmts.Result.pop();
                        result.DoNotIndent = true;
                        result.Add(`with ${cond}${withName ? 'as ' + withName : ''}:`);
                        result.Add(bodyStmts);
                        result.Add("");
                        code.GoNext(2);
                        return result;
                    case OpCodes.EXTENDED_ARG:
                        return "";
                    case OpCodes.SET_ADD:
                        // return "";
                        return DataStack.pop();
                    case OpCodes.MAP_ADD:
                        // return "";
                        return DataStack.pop();
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
                code.GoNext();
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
                    case OpCodes.UNPACK_SEQUENCE:
                        return PycDecompiler.UnpackSequence(obj, code, DataStack);
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

    static UnpackSequence(obj, code, DataStack) {
        let prevOp = code.Prev;
        let count = code.Current.Argument;
        let outExpr = "";
        let rVal = "";

        if (prevOp.OpCodeID != OpCodes.FOR_ITER && DataStack.length > 0) {
            rVal = DataStack.pop();
        }

        for (let idx = 0; idx < count; idx++) {
            let name = PycDecompiler.Identifier(obj, code, DataStack);
            outExpr += (idx > 0 ? ", " : "") + name;
        }

        if (prevOp.OpCodeID == OpCodes.FOR_ITER) {
            return outExpr;
        }

        return outExpr + " = " + rVal.replace(/^\(/,"").replace(/\)$/, "");
    }
}

module.exports = PycDecompiler;