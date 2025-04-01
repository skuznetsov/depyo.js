const AST = require('../ast/ast_node');

function handleCompareOpA() {
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

function handleContainsOpA() {
    let right = this.dataStack.pop();
    let left = this.dataStack.pop();
    // The this.code.Current.Argument will be 0 for 'in' and 1 for 'not in'.
    let node = new AST.ASTCompare (left, right, this.code.Current.Argument ? AST.ASTCompare.CompareOp.NotIn : AST.ASTCompare.CompareOp.In);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleIsOpA() {
    let right = this.dataStack.pop();
    let left = this.dataStack.pop();
    // The this.code.Current.Argument will be 0 for 'is' and 1 for 'is not'.
    let node = new AST.ASTCompare (left, right, this.code.Current.Argument ? AST.ASTCompare.CompareOp.IsNot : AST.ASTCompare.CompareOp.Is);
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

module.exports = {
    handleCompareOpA,
    handleContainsOpA,
    handleIsOpA
};