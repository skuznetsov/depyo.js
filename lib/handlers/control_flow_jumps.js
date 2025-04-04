const AST = require('../ast/ast_node');

function handleJumpIfFalseA() {
    processJumpOps.call(this);
}

function handleJumpIfTrueA() {
    processJumpOps.call(this);
}

function handleJumpIfFalseOrPopA() {
    processJumpOps.call(this);
}

function handleJumpIfTrueOrPopA() {
    processJumpOps.call(this);
}

function handlePopJumpIfFalseA() {
    processJumpOps.call(this);
}

function handlePopJumpIfTrueA() {
    processJumpOps.call(this);
}

function handlePopJumpForwardIfFalseA() {
    processJumpOps.call(this);
}

function handlePopJumpForwardIfTrueA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfFalseA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfTrueA() {
    processJumpOps.call(this);
}

function processJumpOps() {
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

function handleJumpAbsoluteA() {
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

function handleJumpForwardA() {
    processJumpForward.call(this);
}

function handleInstrumentedJumpForwardA() {
    processJumpForward.call(this);
}

function processJumpForward() {
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

function handleJumpIfNotExcMatchA() {
    // TODO: Implement logic for exception matching in jumps
    console.log("OpCode JUMP_IF_NOT_EXC_MATCH_A needs implementation");
}

module.exports = {
    handleJumpIfFalseA,
    handleJumpIfTrueA,
    handleJumpIfFalseOrPopA,
    handleJumpIfTrueOrPopA,
    handlePopJumpIfFalseA,
    handlePopJumpIfTrueA,
    handlePopJumpForwardIfFalseA,
    handlePopJumpForwardIfTrueA,
    handleInstrumentedPopJumpIfFalseA,
    handleInstrumentedPopJumpIfTrueA,
    handleJumpAbsoluteA,
    handleJumpForwardA,
    handleInstrumentedJumpForwardA,
    handleJumpIfNotExcMatchA  
};