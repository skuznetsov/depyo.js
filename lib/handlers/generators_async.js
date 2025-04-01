const AST = require('../ast/ast_node');

function handleInstrumentedYieldValueA() {
    this.handleYieldValue();
}

function handleYieldValue() {
    let value = this.dataStack.pop();
    let node = new AST.ASTReturn(value, AST.ASTReturn.RetType.Yield);
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function handleYieldFrom() {
    let dest = this.dataStack.pop();
    // TODO: Support yielding into a non-null destination
    let valueNode = this.dataStack.top();
    if (valueNode) {
        let node = new AST.ASTReturn(valueNode, AST.ASTReturn.RetType.YieldFrom);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }
}

function handleGetAwaitable() {
    let object = this.dataStack.pop();
    let node = new AST.ASTAwaitable (object);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleGenStartA() {
    this.dataStack.pop();
}

function handleResumeA() {}

function handleInstrumentedResumeA() {}

module.exports = {
    handleGetAwaitable,
    handleYieldFrom,
    handleInstrumentedYieldValueA,
    handleYieldValue,
    handleResumeA,
    handleInstrumentedResumeA,
    handleGenStartA
};