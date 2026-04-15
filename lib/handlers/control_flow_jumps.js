const AST = require('../ast/ast_node');

function isInsideLoop(blocks) {
    return blocks.some(b => [AST.ASTBlock.BlockType.While, AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.AsyncFor].includes(b.blockType));
}

function findBackwardJump(code, startIndex, currentOffset, backJumpOpcodes) {
    const instructions = code.Instructions || [];
    const maxLookahead = 100;
    for (let i = startIndex + 1; i < instructions.length && i <= startIndex + maxLookahead; i++) {
        const instr = instructions[i];
        if (!instr) {
            break;
        }
        if (backJumpOpcodes.includes(instr.OpCodeID) && instr.JumpTarget <= currentOffset) {
            return instr;
        }
        // Bail out once we are well past the current conditional to avoid accidental matches.
        if (instr.Offset - currentOffset > 300) {
            break;
        }
    }
    return null;
}

function tryStartConditionalExpression(ctx, cond, falseOffset) {
    if (!cond || falseOffset <= ctx.code.Current.Offset) {
        return false;
    }
    const falseIdx = ctx.code.GetIndexByOffset(falseOffset);
    if (falseIdx < 0) {
        return false;
    }

    // Statement terminators inside the true-branch: if the branch ends with a
    // side-effecting instruction (STORE_*, POP_TOP, RETURN, RAISE) before the
    // candidate JUMP_FORWARD, this is an if/else, not a ternary, and we must
    // not push a pending — that would suppress the real If block.
    const storeOps = new Set([
        ctx.OpCodes.STORE_FAST_A,
        ctx.OpCodes.STORE_NAME_A,
        ctx.OpCodes.STORE_GLOBAL_A,
        ctx.OpCodes.STORE_DEREF_A,
        ctx.OpCodes.STORE_ATTR_A,
        ctx.OpCodes.STORE_SUBSCR,
        ctx.OpCodes.STORE_SUBSCR_A,
        ctx.OpCodes.POP_TOP,
        ctx.OpCodes.POP_TOP_A,
        ctx.OpCodes.RETURN_VALUE,
        ctx.OpCodes.RETURN_VALUE_A,
        ctx.OpCodes.RETURN_CONST_A,
        ctx.OpCodes.RAISE_VARARGS_A,
    ].filter(v => v !== undefined));
    const blockOpeners = new Set([
        ctx.OpCodes.SETUP_EXCEPT_A,
        ctx.OpCodes.SETUP_FINALLY_A,
        ctx.OpCodes.SETUP_LOOP_A,
        ctx.OpCodes.SETUP_WITH_A,
        ctx.OpCodes.SETUP_ASYNC_WITH_A,
        ctx.OpCodes.FOR_ITER_A,
    ].filter(v => v !== undefined));

    let joinInstr = null;
    for (let i = ctx.code.CurrentInstructionIndex + 1; i < falseIdx; i++) {
        const instr = ctx.code.Instructions[i];
        if (!instr) {
            continue;
        }
        // Crossing a block opener disqualifies: the JUMP_FORWARD inside the
        // nested block is not the true-branch's join.
        if (blockOpeners.has(instr.OpCodeID)) {
            return false;
        }
        if ([ctx.OpCodes.JUMP_FORWARD_A, ctx.OpCodes.JUMP_ABSOLUTE_A].includes(instr.OpCodeID)) {
            // Look at the instruction immediately before the jump. For a ternary,
            // it should leave a value on the stack (LOAD_*, BUILD_*, arithmetic),
            // not be a statement terminator.
            const prev = ctx.code.Instructions[i - 1];
            if (prev && storeOps.has(prev.OpCodeID)) {
                return false;
            }
            const target = instr.JumpTarget ?? -1;
            if (target > falseOffset && target <= falseOffset + 50) {
                joinInstr = instr;
                break;
            }
        }
    }

    if (!joinInstr) {
        return false;
    }

    ctx.pendingConditionalExprs ||= [];
    ctx.pendingConditionalExprs.push({
        cond,
        falseOffset,
        joinOffset: joinInstr.JumpTarget,
        trueValue: null,
        startOffset: ctx.code.Current.Offset
    });
    return true;
}

function captureTrueBranchForConditional(ctx) {
    if (!ctx.pendingConditionalExprs?.length) {
        return false;
    }
    const target = ctx.code.Current.JumpTarget;
    const pending = ctx.pendingConditionalExprs.find(p => p.joinOffset === target);
    if (!pending) {
        return false;
    }
    // A real ternary leaves the true-branch expression on the data stack; if
    // the stack is empty, this JUMP_FORWARD belongs to some other structure
    // (e.g. a nested try/except whose exit jump happens to land on the same
    // offset) and we must not consume it.
    if (!ctx.dataStack.length) {
        return false;
    }
    // Block openers between pending.startOffset and here mean the JUMP_FORWARD
    // is inside a nested scope and cannot be the ternary's true branch.
    const blockOpeners = new Set([
        ctx.OpCodes.SETUP_EXCEPT_A,
        ctx.OpCodes.SETUP_FINALLY_A,
        ctx.OpCodes.SETUP_LOOP_A,
        ctx.OpCodes.SETUP_WITH_A,
        ctx.OpCodes.SETUP_ASYNC_WITH_A,
        ctx.OpCodes.FOR_ITER_A,
    ].filter(v => v !== undefined));
    const startIdx = ctx.code.GetIndexByOffset(pending.startOffset);
    const curIdx = ctx.code.CurrentInstructionIndex;
    if (startIdx >= 0) {
        for (let i = startIdx + 1; i < curIdx; i++) {
            const instr = ctx.code.Instructions[i];
            if (instr && blockOpeners.has(instr.OpCodeID)) {
                return false;
            }
        }
    }
    pending.trueValue = ctx.dataStack.pop();
    return true;
}

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

function handlePopJumpForwardIfNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpForwardIfNotNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpBackwardIfNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpBackwardIfNotNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpIfNoneA() {
    processJumpOps.call(this);
}

function handlePopJumpIfNotNoneA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfFalseA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfTrueA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfNoneA() {
    processJumpOps.call(this);
}

function handleInstrumentedPopJumpIfNotNoneA() {
    processJumpOps.call(this);
}

function processJumpOps() {
    if (this.skipNextJump) {
        this.skipNextJump = false;
        if (this.code.Next?.OpCodeID == this.OpCodes.POP_TOP) {
            this.code.GoNext();
        }
        return;
    }

    const wrapNoneComparison = (expectNone) => {
        let value = this.dataStack.pop();
        let cmp = new AST.ASTCompare(
            value,
            new AST.ASTNone(),
            expectNone ? AST.ASTCompare.CompareOp.Is : AST.ASTCompare.CompareOp.IsNot
        );
        cmp.line = this.code.Current.LineNo;
        this.dataStack.push(cmp);
    };

    const jumpIfNotNoneOpcodes = [
        this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
    ];

    const jumpIfNoneOpcodes = [
        this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_IF_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A
    ];

    if (jumpIfNoneOpcodes.includes(this.code.Current.OpCodeID)) {
        wrapNoneComparison(true);
    } else if (jumpIfNotNoneOpcodes.includes(this.code.Current.OpCodeID)) {
        wrapNoneComparison(false);
    }

    if (this.inMatchPattern) {
        this.debug(`[processJumpOps] Inside match statement - tracking pattern instead of creating if block`);

        if ([
            this.OpCodes.POP_JUMP_IF_FALSE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
            this.OpCodes.POP_JUMP_IF_TRUE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_IF_NONE_A,
            this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
        ].includes(this.code.Current.OpCodeID)) {
            this.dataStack.pop();
        }

        return;
    }

    // CRITICAL: Close blocks that have ended before creating new conditional block
    // This ensures proper sibling relationships between if/elif blocks
    while (this.curBlock.end > 0 &&
           this.curBlock.end <= this.code.Current.Offset &&
           this.curBlock.blockType != AST.ASTBlock.BlockType.Main &&
           this.blocks.length > 1) {

        if (global.g_cliArgs?.debug) {
            console.log(`[processJumpOps] Closing ended block ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}) at offset ${this.code.Current.Offset}`);
        }

        let closedBlock = this.blocks.pop();
        this.curBlock = this.blocks.top();
        this.curBlock.append(closedBlock);

        if (global.g_cliArgs?.debug) {
            console.log(`  → Appended to ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}), now has ${this.curBlock.nodes.length} nodes`);
        }
    }

    if (this.ignoreNextConditional) {
        this.ignoreNextConditional = false;
        const baseDepth = this.cleanupStackDepth || this.dataStack.length;
        while (this.dataStack.length >= baseDepth) {
            this.dataStack.pop();
        }
        this.cleanupStackDepth = null;
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
            this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
            this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_IF_NONE_A,
            this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
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
            this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A, this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A, this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
            this.OpCodes.POP_JUMP_IF_NONE_A, this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
            this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A, this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
        ].includes(this.code.Current.OpCodeID)) {
        /* Offset is relative in these cases */
        offs += this.code.Next?.Offset;
    }

    const rawJumpTarget = offs; // target before block end normalization
    [offs] = this.code.FindEndOfBlock(offs);

    const condJumpOpcodes = new Set([
        this.OpCodes.POP_JUMP_IF_FALSE_A,
        this.OpCodes.POP_JUMP_IF_TRUE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NONE_A,
        this.OpCodes.POP_JUMP_BACKWARD_IF_NOT_NONE_A,
        this.OpCodes.POP_JUMP_IF_NONE_A,
        this.OpCodes.POP_JUMP_IF_NOT_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A,
        this.OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A
    ]);
    const backJumpOpcodes = [
        this.OpCodes.JUMP_ABSOLUTE_A,
        this.OpCodes.JUMP_BACKWARD_A,
        this.OpCodes.JUMP_BACKWARD_NO_INTERRUPT_A
    ];

    // Python 3.8+ while-loops no longer emit SETUP_LOOP; detect via backward jumps.
    if (!this.inMatchPattern &&
        condJumpOpcodes.has(this.code.Current.OpCodeID) &&
        !isInsideLoop(this.blocks)) {
        const backJump = findBackwardJump(this.code, this.code.CurrentInstructionIndex, this.code.Current.Offset, backJumpOpcodes);
        // Treat as a while-loop only when the body extends past the backward jump target.
        if (backJump && offs > backJump.Offset) {
            const loopStart = backJump.JumpTarget;
            const whileBlk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, loopStart, offs, null, false);
            whileBlk.line = this.code.Current.LineNo;
            this.blocks.push(whileBlk);
            this.curBlock = whileBlk;
        }
    }

    const isEgMatchCall = cond instanceof AST.ASTCall &&
        cond.func instanceof AST.ASTName &&
        cond.func.name === "__check_eg_match__";
    const isExceptCompare = cond instanceof AST.ASTCompare &&
        cond.op == AST.ASTCompare.CompareOp.Exception;

    // Conditional expression (a if cond else b) heuristic:
    // POP_JUMP_IF_* to falseOffset, then JUMP_FORWARD to joinOffset > falseOffset.
    // Skip for exception matches: except handlers emit a similar bytecode shape
    // (POP_JUMP_IF_FALSE past handler body, JUMP_FORWARD over END_FINALLY) but
    // are not ternary expressions and must not be rewritten.
    if (!this.inMatchPattern &&
        !isExceptCompare && !isEgMatchCall &&
        condJumpOpcodes.has(this.code.Current.OpCodeID) &&
        tryStartConditionalExpression(this, cond, rawJumpTarget)) {
        return;
    }

    if ([   this.OpCodes.JUMP_IF_FALSE_A,
            this.OpCodes.JUMP_IF_TRUE_A
        ].includes(this.code.Current.OpCodeID) &&
        this.code.Next?.OpCodeID == this.OpCodes.POP_TOP
    ) {
        this.code.GoNext();
    }

    if (global.g_cliArgs?.debug) {
        console.log(`\nConditional jump at offset ${this.code.Current.Offset}: curBlock=${this.curBlock.type_str} (type=${this.curBlock.blockType}), size=${this.curBlock.size}, inited=${this.curBlock.inited}`);
        if (this.curBlock.size > 0) {
            console.log(`  Block nodes:`, this.curBlock.nodes.map(n => `${n.constructor.name}`));
        }
    }

    if (isExceptCompare || isEgMatchCall) {
        if (global.g_cliArgs?.debug) {
            const matchType = isExceptCompare ? cond.right : cond.pparams?.[1];
            console.log(`  EXCEPTION MATCH detected: Creating Except block with condition=${matchType?.constructor?.name} ${matchType?.codeFragment?.()}`);
        }

        const handlerEnd = this.findExceptionHandlerEnd ? this.findExceptionHandlerEnd(this.code.Current.Offset) : null;
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except
                && this.curBlock.condition == null) {
            // Reuse current except block (from exception table or pushed by JUMP_FORWARD)
            // instead of creating a nested one. Return immediately to avoid the
            // fall-through that would otherwise create a stray If block on top.
            this.curBlock.condition = isExceptCompare ? cond.right : cond.pparams?.[1];
            if (handlerEnd) {
                this.curBlock.end = handlerEnd;
            }
            this.curBlock.init();
            return;
        } else {
            const end = handlerEnd || offs;
            const matchType = isExceptCompare ? cond.right : cond.pparams?.[1];
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, end, matchType, false);
            this.inExceptionTableHandler = true;
        }
    } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Else) {
        if (global.g_cliArgs?.debug) {
            console.log(`  Checking ELIF conditions: size=${this.curBlock.size}, blockType=${this.curBlock.blockType}`);
            if (this.curBlock.size == 1) {
                console.log(`    First node: ${this.curBlock.nodes[0].constructor.name}, blockType=${this.curBlock.nodes[0].blockType}`);
            }
        }

        // Only collapse else→elif when the Else attaches to an If/Elif.
        // `while/for ... else: if X: ...` must stay as a nested if, since
        // rendering `elif` after `while/for` is invalid Python. The Else's
        // prior sibling (last node in the enclosing block) reveals what
        // the Else was created for.
        let elseHolder = this.blocks.length >= 2
            ? this.blocks[this.blocks.length - 2]
            : null;
        let priorSibling = elseHolder && elseHolder.size > 0
            ? elseHolder.nodes[elseHolder.size - 1]
            : null;
        let elseAttachesToIf = priorSibling instanceof AST.ASTCondBlock &&
            (priorSibling.blockType == AST.ASTBlock.BlockType.If ||
             priorSibling.blockType == AST.ASTBlock.BlockType.Elif);

        if (elseAttachesToIf &&
            (this.curBlock.size == 0 ||
             (this.curBlock.size == 1 &&
              this.curBlock.nodes[0] instanceof AST.ASTCondBlock &&
              this.curBlock.nodes[0].blockType == AST.ASTBlock.BlockType.If))) {
            /* Collapse into elif statement */
            if (global.g_cliArgs?.debug) {
                console.log(`ELIF DETECTED: else block size=${this.curBlock.size}, converting to elif at offset ${this.code.Current.Offset}`);
            }
            let startOffset = this.curBlock.start;

            // If else block contains an if statement, remove it (we're converting it to elif)
            if (this.curBlock.size == 1) {
                this.curBlock.nodes.pop();
            }

            this.blocks.pop();
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Elif, startOffset, offs, cond, neg);
        }
    } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Else
                && this.curBlock.size > 0) {
        /* Else block not empty - elif not possible */
        if (global.g_cliArgs?.debug) {
            console.log(`ELIF NOT CREATED: else block size=${this.curBlock.size} (not 0) at offset ${this.code.Current.Offset}, nodes:`, this.curBlock.nodes.map(n => n.constructor.name));
        }
    }
    if (this.curBlock.size == 0 && !this.curBlock.inited
                && this.curBlock.blockType == AST.ASTBlock.BlockType.While
                && this.code.Current.LineNo == this.curBlock.line) {
        /* The condition for a while loop */
        let top = this.blocks.top();
        top.condition = cond;
        top.negative = neg;
        if (popped) {
            top.init(popped);
        }

        if (global.g_cliArgs?.debug) {
            console.log(`[processJumpOps] Set while condition at offset ${this.code.Current.Offset}: ${cond?.constructor?.name} = ${cond?.codeFragment ? cond.codeFragment() : cond}`);
        }
        return;
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
    }

    if (!ifblk) {
        /* Plain old if statement - but check if it should be elif */
        let shouldBeElif = false;

        // Check if this should be an elif instead of if
        // This happens when there's no else block (e.g., when previous if/elif has return)
        if (this.blocks.length > 0) {
            let parent = this.blocks.top();
            if (parent.size > 0) {
                let lastNode = parent.nodes[parent.size - 1];

                // If the last node in parent is an if/elif block, this should be elif
                // The key insight: if lastNode is CLOSED (not in block stack), it's a sibling
                // Check if lastNode is in block stack - if not, it's closed and safe to use as elif base
                let lastNodeInStack = false;
                for (let i = 0; i < this.blocks.length; i++) {
                    if (this.blocks[i] === lastNode) {
                        lastNodeInStack = true;
                        break;
                    }
                }

                if (lastNode instanceof AST.ASTCondBlock &&
                    (lastNode.blockType == AST.ASTBlock.BlockType.If ||
                     lastNode.blockType == AST.ASTBlock.BlockType.Elif) &&
                    !lastNodeInStack) {  // CLOSED, not in stack = sibling!

                    // Assert-style guards (`if not X: raise`) don't chain as elif.
                    // `assert X; assert Y` and `if not X: raise; if not Y: raise`
                    // share bytecode shape with elif, but rendering the second as
                    // elif creates an orphan `elif` after the first becomes `assert`.
                    let priorIsAssertGuard =
                        lastNode.negative &&
                        lastNode.nodes.length == 1 &&
                        lastNode.nodes[0] instanceof AST.ASTRaise;

                    if (!priorIsAssertGuard) {
                        shouldBeElif = true;

                        if (global.g_cliArgs?.debug) {
                            console.log(`ELIF DETECTED: Creating elif at offset ${this.code.Current.Offset} (follows ${lastNode.type_str} at ${lastNode.start})`);
                        }
                    }
                }
            }
        }

        if (shouldBeElif) {
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Elif, this.code.Current.Offset, offs, cond, neg);
        } else {
            ifblk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.If, this.code.Current.Offset, offs, cond, neg);
        }
        ifblk.line = this.code.Current.LineNo;
    }

    if (ifblk) {
        if (popped)
            ifblk.init(popped);

        this.blocks.push(ifblk);
        this.curBlock = this.blocks.top();
    }
}

function handleJumpAbsoluteA() {
    if (this.skipNextJump) {
        this.skipNextJump = false;
        return;
    }

    // CRITICAL: Close blocks that have ended before processing jump
    // Unconditional jumps often mark the end of blocks (especially loops)
    while (this.curBlock.end > 0 &&
           this.curBlock.end <= this.code.Current.Offset &&
           this.curBlock.blockType != AST.ASTBlock.BlockType.Main &&
           this.blocks.length > 1) {

        if (global.g_cliArgs?.debug) {
            console.log(`[handleJumpAbsolute] Closing ended block ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}) at offset ${this.code.Current.Offset}`);
        }

        let closedBlock = this.blocks.pop();
        this.curBlock = this.blocks.top();
        this.curBlock.append(closedBlock);

        if (global.g_cliArgs?.debug) {
            console.log(`  → Appended to ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}), now has ${this.curBlock.nodes.length} nodes`);
        }
    }

    let offs = this.code.Current.Argument;
    if (this.object.Reader.versionCompare(3, 10) >= 0) {
        offs *= 2; // 2 bytes size - BPO-27129
    }

    // [offs] = this.code.FindEndOfBlock(offs);

    // Inside a try-inside-loop (e.g. `while x: try: ... except: ...`),
    // the successful-path jump back to the loop is emitted as JUMP_ABSOLUTE
    // instead of JUMP_FORWARD. If we don't open the Except block here, the
    // handler body ends up appended to the container as raw statements and
    // the `__exception__` placeholder leaks into the output.
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
        let cont = this.curBlock;
        if (cont.hasExcept && this.code.Next?.Offset <= cont.except) {
            // Find the END_FINALLY that closes this except so the handler body
            // stays attached to the Except block rather than leaking back into
            // the Container.
            let handlerEnd = cont.except;
            let cursor = cont.except;
            for (let i = 0; i < 200; i++) {
                const instr = this.code.PeekInstructionAtOffset(cursor);
                if (!instr) break;
                if (instr.OpCodeID === this.OpCodes.END_FINALLY) {
                    handlerEnd = instr.Offset;
                    break;
                }
                cursor = instr.Offset + (instr.Size || 3);
            }
            cont.end = handlerEnd;
            let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, handlerEnd, null, false);
            except.init();
            this.blocks.push(except);
            this.curBlock = this.blocks.top();
            return;
        }
    }

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
                    top.addGenerator(this.curBlock);
                    this.blocks.pop();
                    this.curBlock = this.blocks.top();
                    // For multi-clause comprehensions/genexprs, keep the
                    // ASTComprehension on the data stack so the enclosing
                    // For+comprehension block can attach its own generator.
                    // Only materialize it as a statement once we're clear of
                    // comprehension-tagged for-blocks.
                    if (!(this.curBlock.blockType == AST.ASTBlock.BlockType.For && this.curBlock.comprehension)) {
                        let comp = this.dataStack.pop();
                        this.curBlock.append(comp);
                    }
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
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except
                && this.code.PeekInstructionAtOffset
                && ![this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Prev?.OpCodeID)
                && this.blocks.length >= 2
                && this.blocks[this.blocks.length - 2].blockType == AST.ASTBlock.BlockType.Container) {
            // Python 2.x try/except/else inside a loop: the except handler
            // body ends with JUMP_ABSOLUTE back to the loop start (skipping
            // the else body). Bytecode then has POP_TOP + END_FINALLY + else
            // body, and the else body itself ends with another JUMP_ABSOLUTE
            // to the same loop start. Without this branch, the else body
            // gets attached to the surrounding loop instead of the try.
            let endFinallyAhead = false;
            let scan = this.code.Next?.Offset;
            for (let i = 0; i < 4 && scan != null; i++) {
                const instr = this.code.PeekInstructionAtOffset(scan);
                if (!instr) break;
                if (instr.OpCodeID === this.OpCodes.END_FINALLY) {
                    endFinallyAhead = true;
                    scan = instr.Offset + (instr.Size || 1);
                    break;
                }
                if (instr.OpCodeID !== this.OpCodes.POP_TOP) break;
                scan = instr.Offset + (instr.Size || 1);
            }

            if (endFinallyAhead) {
                // Distinguish try/except/else from try/except (no else) inside
                // a loop. With else: bytecode after END_FINALLY is the else
                // body, then a JUMP_ABSOLUTE to loop start. Without else: the
                // very next instruction is the loop's exit JUMP_ABSOLUTE.
                let elseEnd = scan;
                let cursor = scan;
                let hasBody = false;
                for (let i = 0; i < 200; i++) {
                    const instr = this.code.PeekInstructionAtOffset(cursor);
                    if (!instr) break;
                    if (instr.OpCodeID === this.OpCodes.JUMP_ABSOLUTE_A
                            && instr.JumpTarget === this.code.Current.JumpTarget) {
                        elseEnd = instr.Offset + (instr.Size || 3);
                        break;
                    }
                    if (instr.OpCodeID === this.OpCodes.POP_BLOCK) {
                        elseEnd = instr.Offset;
                        break;
                    }
                    hasBody = true;
                    cursor = instr.Offset + (instr.Size || 3);
                }

                if (!hasBody) {
                    // No else body — fall through to default jump handling.
                } else {
                    let except = this.blocks.pop();
                    this.curBlock = this.blocks.top();
                    if (!except.empty()) {
                        this.curBlock.append(except);
                    }
                    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
                        this.curBlock.end = elseEnd;
                    }

                    let elseblk = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, elseEnd);
                    elseblk.init();
                    this.blocks.push(elseblk);
                    this.curBlock = this.blocks.top();
                    return;
                }
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
                // Self-referential JUMP_ABSOLUTE with no enclosing loop is a
                // `while True: pass` that 3.8+ emits without SETUP_LOOP. Emit a
                // synthesized while block so the infinite loop is preserved.
                // Pre-3.8 still has SETUP_LOOP and different jump patterns; leave
                // those branches to the existing loop machinery.
                if (offs === this.code.Current.Offset
                        && this.object.Reader.versionCompare(3, 8) >= 0) {
                    const whileBlk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, offs, offs, null, false);
                    whileBlk.init();
                    whileBlk.line = this.code.Current.LineNo;
                    whileBlk.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
                    this.curBlock.append(whileBlk);
                }
                return;
            }

            // CRITICAL FIX: If JUMP target is OUTSIDE current loop (jump to outer loop or beyond),
            // this marks the END of the current loop! Correct the loop's end offset.
            // This handles nested loops where inner loop jumps to outer loop start.
            if (loopBlock.start > offs) {
                // Jump target is BEFORE loop start = jumping to outer scope
                // Current offset should be the TRUE end of this loop
                if (loopBlock.end > this.code.Current.Offset) {
                    if (global.g_cliArgs?.debug) {
                        console.log(`[handleJumpAbsolute] Correcting loop end: ${loopBlock.type_str}(${loopBlock.start}-${loopBlock.end}) → end=${this.code.Current.Offset} (jump to outer at ${offs})`);
                    }
                    loopBlock.end = this.code.Current.Offset;
                }
            }

            if (this.curBlock.end == this.code.Next?.Offset) {
                return;
            }

            if ([this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Prev?.OpCodeID)) {
                return;
            }

            // Check if current block ends with a terminating keyword (break/continue/return)
            // This check is recursive - it looks into nested blocks to find terminators
            if (this.hasTerminatingKeyword(this.curBlock)) {
                return;
            }

            if ([AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif, AST.ASTBlock.BlockType.Else].includes(this.curBlock.blockType) && this.curBlock.nodes.length == 0) {
                this.curBlock.append(new AST.ASTKeyword(AST.ASTKeyword.Word.Continue));
                return;
            }

            // Let's find actual end of block
            let blockEnd = loopBlock.end;
            let instr = this.code.PeekInstructionAtOffset(blockEnd);
            if (!instr) {
                return;
            }
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

                if (global.g_cliArgs?.debug) {
                    console.log(`ELSE BLOCK CREATED at offset ${this.code.Current.Offset}, end=${next.end}`);
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
    }

    this.curBlock = this.blocks.top();
}

function handleJumpForwardA() {
    processJumpForward.call(this);
}

function handleInstrumentedJumpForwardA() {
    processJumpForward.call(this);
}

function handleJumpA() {
    // Python 3.13+ JUMP: treat as forward jump
    processJumpForward.call(this);
}

function handleJumpNoInterruptA() {
    // Python 3.13+ JUMP_NO_INTERRUPT: same as JUMP for decompilation
    processJumpForward.call(this);
}

function processJumpForward() {
    if (this.skipNextJump) {
        this.skipNextJump = false;
        return;
    }

    // Capture true-branch value for conditional expression (ternary) rewrites.
    if (captureTrueBranchForConditional(this)) {
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
                // For exception groups: only create chained except if there's another CHECK_EG_MATCH ahead.
                // Internal cleanup jumps should not create new except blocks.
                if (this.inExceptionGroup) {
                    const jumpTarget = this.code.Next?.Offset + offs;
                    let hasNextEgMatch = false;
                    // Scan ahead to see if there's a CHECK_EG_MATCH within reasonable range
                    let scanOffset = this.code.Next?.Offset;
                    for (let i = 0; i < 40 && scanOffset <= jumpTarget + 20; i++) {
                        const instr = this.code.PeekInstructionAtOffset(scanOffset);
                        if (!instr) break;
                        if (instr.OpCodeID === this.OpCodes.CHECK_EG_MATCH) {
                            hasNextEgMatch = true;
                            break;
                        }
                        if (instr.OpCodeID === this.OpCodes.CALL_INTRINSIC_2 ||
                            instr.OpCodeID === this.OpCodes.POP_EXCEPT ||
                            instr.OpCodeID === this.OpCodes.RERAISE) {
                            // Reached cleanup, no more handlers
                            break;
                        }
                        scanOffset += 2;
                    }
                    if (!hasNextEgMatch) {
                        prev = null;
                        break;
                    }
                }
                let next = null;

                // try/except/else: JUMP_FORWARD at end of except handler skips
                // past END_FINALLY and the else body. Detect by scanning the
                // few instructions between code.Next and the JUMP target for
                // an END_FINALLY (Python 2.x emits POP_TOP before END_FINALLY).
                let jumpTarget = this.code.Next?.Offset + offs;
                let nextIsElse = this.code.Next?.OpCodeID == this.OpCodes.END_FINALLY;
                if (!nextIsElse && this.code.PeekInstructionAtOffset) {
                    let scan = this.code.Next?.Offset;
                    for (let i = 0; i < 4 && scan != null && scan < jumpTarget; i++) {
                        const instr = this.code.PeekInstructionAtOffset(scan);
                        if (!instr) break;
                        if (instr.OpCodeID === this.OpCodes.END_FINALLY) {
                            nextIsElse = true;
                            break;
                        }
                        if (instr.OpCodeID !== this.OpCodes.POP_TOP) break;
                        scan = instr.Offset + instr.Size;
                    }
                }

                if (nextIsElse) {
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
                    if (global.g_cliArgs?.debug) {
                        console.error("Something TERRIBLE happened!!\n");
                    }
                }
                prev = null;
            } else {
                prev = null;
            }

        } while (prev != null);
    }

    this.curBlock = this.blocks.top();

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
        this.curBlock.end = this.code.Next?.Offset + offs;
    }
}

function handleJumpBackwardA() {
    // Python 3.11+ JUMP_BACKWARD opcode
    // Unconditional backward jump (used in loops)
    // Similar to JUMP_ABSOLUTE but with relative negative offset

    if (global.g_cliArgs?.debug) {
        console.log(`[JUMP_BACKWARD] at offset ${this.code.Current.Offset}, target_delta=${this.code.Current.Argument}`);
    }

    // For loops (for/while/async for), this jumps back to loop start
    // In decompiler context, we don't need to generate explicit "continue" or "goto"
    // The loop structure is already represented by For/While/AsyncFor blocks

    // No action needed - loop control is implicit in block structure
}

function handleJumpBackwardNoInterruptA() {
    // Python 3.11+ JUMP_BACKWARD_NO_INTERRUPT
    // Like JUMP_BACKWARD but doesn't check for pending signals
    // Used in tight loops for optimization

    if (global.g_cliArgs?.debug) {
        console.log(`[JUMP_BACKWARD_NO_INTERRUPT] at offset ${this.code.Current.Offset}`);
    }

    // Same as JUMP_BACKWARD for decompiler purposes
}

function handleJumpIfNotExcMatchA() {
    // Use same logic as other conditional jumps; stack top is comparison result.
    processJumpOps.call(this);
}

function handleNotTaken() {
    // Instrumentation hint (3.13+) used in instrumented builds; ignore for decompilation.
    if (global.g_cliArgs?.debug) {
        console.log(`[NOT_TAKEN] at offset ${this.code.Current.Offset}`);
    }
}

function handleInstrumentedNotTakenA() {
    // Instrumentation marker for untaken branch; no stack effect.
    if (global.g_cliArgs?.debug) {
        console.log(`[INSTRUMENTED_NOT_TAKEN] at offset ${this.code.Current.Offset}`);
    }
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
    handlePopJumpForwardIfNoneA,
    handlePopJumpForwardIfNotNoneA,
    handlePopJumpBackwardIfNoneA,
    handlePopJumpBackwardIfNotNoneA,
    handlePopJumpIfNoneA,
    handlePopJumpIfNotNoneA,
    handleInstrumentedPopJumpIfFalseA,
    handleInstrumentedPopJumpIfTrueA,
    handleInstrumentedPopJumpIfNoneA,
    handleInstrumentedPopJumpIfNotNoneA,
    handleJumpAbsoluteA,
    handleJumpForwardA,
    handleInstrumentedJumpForwardA,
    handleJumpA,
    handleJumpNoInterruptA,
    handleJumpBackwardA,
    handleJumpBackwardNoInterruptA,
    handleJumpIfNotExcMatchA,
    handleNotTaken,
    handleInstrumentedNotTakenA
};
