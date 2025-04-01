const AST = require('../ast/ast_node');

function handleBreakLoop() {
    let keywordNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Break);
    keywordNode.line = this.code.Current.LineNo;
    this.curBlock.append(keywordNode);
}

function handleSetupLoopA() {
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