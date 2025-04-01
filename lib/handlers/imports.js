const AST = require('../ast/ast_node');

function handleImportNameA() {
    if (this.object.Reader.versionCompare(2, 0) < 0) {
        let node = new AST.ASTImport(new AST.ASTName(this.code.Current.Name), null);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    } else {
        let fromlist = this.dataStack.pop();
        if (fromlist instanceof AST.ASTNone) {
            fromlist = null;
        }
        let dots = '';
        if (this.object.Reader.versionCompare(2, 5) >= 0) {
            let importLevelNode = this.dataStack.pop();    // Level
            let importLevel = +importLevelNode?.object || -1;
            if (importLevel > 0) {
                dots = Buffer.alloc(importLevel, '.').toString('ascii');
            }
        }

        let node = new AST.ASTImport (new AST.ASTName(dots + this.code.Current.Name), fromlist);
        node.line = this.code.Current.LineNo;

        if (this.code.Next?.OpCodeID == this.OpCodes.IMPORT_STAR) {
            node.add_store(new AST.ASTStore(new AST.ASTName("*"), null));
            this.code.GoNext();
        } else if (fromlist?.object?.ClassName == 'Py_Tuple' && fromlist.object.Value.length > 0) {
            this.code.extractImportNames(fromlist.object, (name, alias) => {
                node.add_store(new AST.ASTStore(new AST.ASTName(name), new AST.ASTName(alias)));
            });
        } else if (!fromlist) {
            let aliasNode = this.code.GetOpCodeByName("STORE_*");
            node.alias = new AST.ASTName(aliasNode.Label);
            this.code.GoToOffset(aliasNode.Offset);
        } else {
            console.error('WARNING: Not covered situation in IMPORT_NAME.');
        }

        this.curBlock.nodes.push(node);

    }
}

function handleImportFromA() {}

function handleImportStar() {}

module.exports = {
    handleImportNameA,
    handleImportFromA,
    handleImportStar    
};