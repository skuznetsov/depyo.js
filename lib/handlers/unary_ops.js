const AST = require('../ast/ast_node');

function handleUnaryCall() {
    let funcNode = this.dataStack.pop();
    let node = new AST.ASTCall(funcNode, [], []);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleUnaryConvert() {
    let name = this.dataStack.pop();
    let node = new AST.ASTConvert(name);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleUnaryInvert() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Invert);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleUnaryNegative() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Negative);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleUnaryNot() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Not);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleUnaryPositive() {
    let arg = this.dataStack.pop();
    let node = new AST.ASTUnary(arg, AST.ASTUnary.UnaryOp.Positive);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}


module.exports = {
    handleUnaryCall,
    handleUnaryConvert,
    handleUnaryInvert,
    handleUnaryNegative,
    handleUnaryNot,
    handleUnaryPositive
};