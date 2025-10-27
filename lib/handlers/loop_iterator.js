const AST = require('../ast/ast_node');

function handleBreakLoop() {
    let keywordNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Break);
    keywordNode.line = this.code.Current.LineNo;
    this.curBlock.append(keywordNode);

    // Mark code as unreachable until the end of CURRENT BLOCK (not entire loop)
    // This allows alternative branches (elif/else) to be processed correctly
    //
    // WRONG approach: unreachableUntil = loopBlock.end (too broad, skips elif!)
    // RIGHT approach: unreachableUntil = curBlock.end (only this branch)
    if (this.curBlock.end > this.code.Current.Offset) {
        this.unreachableUntil = this.curBlock.end;

        if (global.g_cliArgs?.debug) {
            console.log(`BREAK at offset ${this.code.Current.Offset}: curBlock=${this.curBlock.type_str} (${this.curBlock.start}-${this.curBlock.end})`);
            console.log(`  Block stack: ${this.blocks.map((b,i) => `[${i}]${b.type_str}(${b.start}-${b.end})`).join(', ')}`);
            console.log(`  Marking unreachable until ${this.unreachableUntil}`);
        }
    }
}

function handleSetupLoopA() {
    if (global.g_cliArgs?.debug) {
        console.log(`[handleSetupLoopA] Creating while at offset ${this.code.Current.Offset}, JumpTarget=${this.code.Current.JumpTarget}`);
        console.log(`  Data stack size: ${this.dataStack.length}`);
        if (this.dataStack.length > 0) {
            let top = this.dataStack.top();
            console.log(`  Stack top: ${top?.constructor?.name} = ${top?.codeFragment ? top.codeFragment() : top}`);
        }
    }

    let nextBlock = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, this.code.Current.Offset, this.code.Current.JumpTarget, null, false);
    nextBlock.line = this.code.Current.LineNo;
    this.blocks.push(nextBlock);
    this.curBlock = this.blocks.top();
}

function handleContinueLoopA() {
    let node = new AST.ASTKeyword (AST.ASTKeyword.Word.Continue);
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleForIterA() {
    handleInstrumentedForIterA.call(this);
}

function handleInstrumentedForIterA() {
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

function handleForLoopA() {
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

    this.dataStack.push(iter);
    this.dataStack.push(curidx);
    this.dataStack.push(null);
}

function handleGetAiter() {
    // Logic similar to FOR_ITER_A
    let iter = this.dataStack.pop(); // Iterable

    let start = this.code.Current.Offset;
    let end = 0;
    let line = this.code.Current.LineNo;
    let comprehension = false;

    let top = this.blocks.top();

    // Python 3.8+ removed SETUP_LOOP, so we need to infer the block end
    if (this.object.Reader.versionCompare(3, 8) >= 0 || top.blockType != AST.ASTBlock.BlockType.While) {
        // Find END_ASYNC_FOR to determine block end
        // Scan forward to find END_ASYNC_FOR opcode
        let searchLimit = 200;
        for (let i = 1; i < searchLimit; i++) {
            let instr = this.code.PeekInstructionAt(this.code.CurrentInstructionIndex + i);
            if (!instr) break;

            if (instr.OpCodeID == this.OpCodes.END_ASYNC_FOR) {
                end = instr.Offset + instr.Size;
                break;
            }
        }

        if (end == 0) {
            console.error(`Could not find END_ASYNC_FOR for GET_AITER at offset ${start}`);
            end = start + 100; // Fallback
        }

        // Check if this is an async comprehension (generator expression)
        comprehension = this.code.Current.Name &&
                       (this.code.Current.Name.includes("comp>") ||
                        this.code.Current.Name.includes("genexpr>"));

        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.AsyncFor, start, end, iter);
        forblk.line = line;
        forblk.comprehension = comprehension;
        this.blocks.push(forblk);
        this.curBlock = this.blocks.top();
        this.dataStack.push(null);
    } else if (top.blockType == AST.ASTBlock.BlockType.While) {
        // Python 3.7 and earlier with SETUP_LOOP: SETUP_LOOP creates While block first
        this.blocks.pop();
        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.AsyncFor, top.start, top.end, iter);
        forblk.line = line;
        this.blocks.push(forblk);
        this.curBlock = this.blocks.top();
        this.dataStack.push(null);
    } else {
        console.error(`Unexpected block type for GET_AITER: ${top.type_str} at offset ${start}\n`);
    }
}

function handleGetAnext() {
    let iter = this.dataStack.top();
    let callNode = new AST.ASTCall(new AST.ASTName('await'), [new AST.ASTBinary(iter, new AST.ASTName('__anext__'), AST.ASTBinary.BinOp.Attr)], []);
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleGetIter() {
    handleGetYieldFromIter.call(this);
}

function handleGetYieldFromIter() {
    /* We just entirely ignore this */
    if (this.code.Next.OpCodeID == this.OpCodes.CALL_FUNCTION_A) {
        this.dataStack.push(new AST.ASTIteratorValue(this.dataStack.pop()));
    }
}

module.exports = {
    handleBreakLoop,
    handleContinueLoopA,
    handleForIterA,
    handleInstrumentedForIterA,
    handleForLoopA,
    handleGetAiter,
    handleGetAnext,
    handleGetIter,
    handleGetYieldFromIter,
    handleSetupLoopA,
};