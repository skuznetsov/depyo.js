const PycObject = require('../PythonObject').PythonObject;
const AST = require('../ast/ast_node');

function handleUnpackListA() {
    processUnpack.call(this);
}

function handleUnpackTupleA() {
    processUnpack.call(this);
}

function handleUnpackSequenceA() {
    processUnpack.call(this);
}

function processUnpack() {
    this.unpack = this.code.Current.Argument;

    // Record pattern operation if in pattern matching
    if (this.inMatchPattern) {
        this.patternOps.push({
            type: 'UNPACK_SEQUENCE',
            count: this.unpack
        });
    }

    if (this.unpack > 0) {
        let node = new AST.ASTTuple([]);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    } else {
        // Unpack zero values and assign it to top of stack or for loop variable.
        // E.g. [] = TOS / for [] in X
        let tupleNode = new AST.ASTTuple([]);
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
            && !this.curBlock.inited) {
            tupleNode.requireParens = true;
            this.curBlock.index = tupleNode;
        } else if (this.dataStack.top() instanceof AST.ASTChainStore) {
            let chainStore = this.dataStack.pop();
            chainStore.line = this.code.Current.LineNo;
            this.append_to_chain_store(chainStore, tupleNode);
        } else {
            let node = new AST.ASTStore(this.dataStack.pop(), tupleNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }
}

function handleUnpackArgA() {
    let data = this.dataStack.pop();
    this.object.ArgCount = this.code.Current.Argument;
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {                                
        this.object.VarNames.Value.push(data[idx]);
    }
    this.code.GoNext(this.code.Current.Argument);
}

function handleUnpackExA() {
    this.unpack = (this.code.Current.Argument & 0xFF);
    this.starPos = this.unpack;
    this.unpack += 1 + (this.code.Current.Argument >> 8) & 0xFF;

    let source = this.dataStack.pop();
    let tuple = new AST.ASTTuple([]);
    tuple.requireParens = false;
    this.dataStack.push(new PycObject("Py_Null"));
    this.dataStack.push(new AST.ASTChainStore([], source));
    this.dataStack.push(tuple);
}

function handleBuildListUnpackA() {
    processBuild.call(this);
}

function handleBuildTupleUnpackA() {
    processBuild.call(this);
}

function handleBuildTupleUnpackWithCallA() {
    // Python 3.6+ - same as BUILD_TUPLE_UNPACK but with better error messages
    processBuild.call(this);
}

function processBuild() {
    let values = [];
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        values.unshift(this.dataStack.pop());
    }
    let listNode = new AST.ASTList(values); // Or ASTTuple based on opcode
    this.dataStack.push(listNode);
}

function handleBuildSetUnpackA() {
    let values = [];
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        values.unshift(this.dataStack.pop());
    }
    let setNode = new AST.ASTSet(values);
    this.dataStack.push(setNode);
}

function handleBuildMapUnpackA() {
    // Py 3.5-3.8: count of mappings to merge for {**a, **b} dict literal.
    processBuildMapUnpack.call(this, /*withCall=*/false);
}

function handleBuildMapUnpackWithCallA() {
    // Py 3.5 only: oparg = count + (fn_loc << 8). Lower byte is the map count,
    // upper byte locates the callable for error reporting.
    // Py 3.6-3.8: oparg = plain count (this opcode is kept for unpack-with-call
    // semantics but the fn_loc byte is dropped).
    processBuildMapUnpack.call(this, /*withCall=*/true);
}

function processBuildMapUnpack(withCall) {
    let count = this.code.Current.Argument;
    if (withCall && this.object.Reader.versionCompare(3, 6) < 0) {
        count = count & 0xFF;
    }
    let items = [];
    for (let idx = 0; idx < count; idx++) {
        items.unshift(this.dataStack.pop());
    }
    let node = new AST.ASTMapUnpack(items);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

module.exports = {
    handleUnpackListA,
    handleUnpackTupleA,
    handleUnpackSequenceA,
    handleUnpackArgA,
    handleUnpackExA,
    handleBuildListUnpackA,
    handleBuildTupleUnpackA,
    handleBuildTupleUnpackWithCallA,
    handleBuildSetUnpackA,
    handleBuildMapUnpackA,
    handleBuildMapUnpackWithCallA
};
