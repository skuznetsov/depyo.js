const AST = require('../ast/ast_node');

function handleBuildTemplateA() {
    // Python 3.14 BUILD_TEMPLATE: template objects for f-strings; keep stack as-is (operands already handled by formatting ops).
    const count = this.code.Current.Argument || 0;
    const items = [];
    for (let i = 0; i < count; i++) {
        items.unshift(this.dataStack.pop());
    }
    // Re-push items as a tuple-like collection to preserve stack shape.
    const tpl = new AST.ASTTuple(items);
    tpl.requireParens = false;
    this.dataStack.push(tpl);
}

module.exports = {
    handleBuildTemplateA
};
