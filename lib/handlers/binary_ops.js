const AST = require('../ast/ast_node');

function handleBinaryOpA()
{
    let rVal = this.dataStack.pop();
    let lVal = this.dataStack.pop();
    let op = AST.ASTBinary.from_binary_op(this.code.Current.Argument);
    if (op == AST.ASTBinary.BinOp.InvalidOp) {
        // TODO: Throw and handle proper exeception.
        throw new SyntaxError("Invalid op");
    }
    let node = new AST.ASTBinary(lVal, rVal,op);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleBinaryAdd() {
    processBinaryOp.call(this);
}

function handleBinaryAnd() {
    processBinaryOp.call(this);
}

function handleBinaryDivide(){
    processBinaryOp.call(this);
}

function handleBinaryFloorDivide() {
    processBinaryOp.call(this);
}

function handleBinaryLshift(){
    processBinaryOp.call(this);
}

function handleBinaryModulo() {
    processBinaryOp.call(this);
}

function handleBinaryMultiply() {
    processBinaryOp.call(this);
}

function handleBinaryOr() {
    processBinaryOp.call(this);
}

function handleBinaryPower() {
    processBinaryOp.call(this);
}

function handleBinaryRshift() {
    processBinaryOp.call(this);
}

function handleBinarySubtract() {
    processBinaryOp.call(this);
}

function handleBinaryTrueDivide() {
    processBinaryOp.call(this);
}

function handleBinaryXor() {
    processBinaryOp.call(this);
}

function handleBinaryMatrixMultiply() {
    processBinaryOp.call(this);
}

function handleInplaceAdd() {
    processBinaryOp.call(this);
}

function handleInplaceAnd() {
    processBinaryOp.call(this);
}

function handleInplaceDivide() {
    processBinaryOp.call(this);
}

function handleInplaceFloorDivide() {
    processBinaryOp.call(this);
}

function handleInplaceLShift() {
    processBinaryOp.call(this);
}

function handleInplaceModulo() {
    processBinaryOp.call(this);
}

function handleInplaceMultiply() {
    processBinaryOp.call(this);
}

function handleInplaceOr() {
    processBinaryOp.call(this);
}

function handleInplacePower() {
    processBinaryOp.call(this);
}

function handleInplaceRshift() {
    processBinaryOp.call(this);
}

function handleInplaceSubtract() {
    processBinaryOp.call(this);
}

function handleInplaceTrueDivide() {
    processBinaryOp.call(this);
}

function handleInplaceXor() {
    processBinaryOp.call(this);
}

function handleInplaceMatrixMultiply() {
    processBinaryOp.call(this);
}

function processBinaryOp()
{
    let rVal = this.dataStack.pop();
    let lVal = this.dataStack.pop();
    let op = AST.ASTBinary.from_opcode(this.code.Current.OpCodeID);
    if (op == AST.ASTBinary.BinOp.InvalidOp) {
        // TODO: Throw and handle proper exeception.
        throw new SyntaxError("Invalid op");
    }
    let node = new AST.ASTBinary(lVal, rVal,op);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

module.exports = {
    handleBinaryOr,
    handleBinaryAdd,
    handleBinaryAnd,
    handleBinaryDivide,
    handleBinaryFloorDivide,
    handleBinaryLshift,
    handleBinaryModulo,
    handleBinaryMultiply,
    handleBinaryOr,
    handleBinaryPower,
    handleBinaryRshift,
    handleBinarySubtract,
    handleBinaryTrueDivide,
    handleBinaryXor,
    handleBinaryMatrixMultiply,
    handleInplaceAdd,
    handleInplaceAnd,
    handleInplaceDivide,
    handleInplaceFloorDivide,
    handleInplaceLShift,
    handleInplaceModulo,
    handleInplaceMultiply,
    handleInplaceOr,
    handleInplacePower,
    handleInplaceRshift,
    handleInplaceSubtract,
    handleInplaceTrueDivide,
    handleInplaceXor,
    handleInplaceMatrixMultiply,
    handleBinaryOpA
};