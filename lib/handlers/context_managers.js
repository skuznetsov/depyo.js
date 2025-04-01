const AST = require('../ast/ast_node');

function handleSetupWithA() {
    let withBlock = new AST.ASTWithBlock(this.code.Current.Offset, this.code.Current.JumpTarget);
    this.blocks.push(withBlock);
    this.curBlock = this.blocks.top();
}

function handleWithCleanupStart() {
    handleWithCleanup.call(this);
}

function handleWithCleanup() {
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

function handleWithCleanupFinish() {
            /* Ignore this */
}

function handleBeforeAsyncWith() {
    let ctxmgr = this.dataStack.top();
    let callNode = new AST.ASTCall(new AST.ASTName('await'), [new AST.ASTBinary(ctxmgr, new AST.ASTName('__aenter__'), AST.ASTBinary.BinOp.Attr)], []);
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleSetupAsyncWithA() {
    let asyncWithBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.AsyncWith, this.code.Current.Offset, this.code.Current.JumpTarget);
    this.blocks.push(asyncWithBlock);
    this.curBlock = this.blocks.top();
}

module.exports = {
    handleBeforeAsyncWith,
    handleSetupWithA,
    handleWithCleanupStart,
    handleWithCleanup,
    handleWithCleanupFinish,
    handleSetupAsyncWithA
};