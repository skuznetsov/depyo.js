const AST = require('../ast/ast_node');

function handleDupTop() {
    if (this.dataStack.top() == null) {
        this.dataStack.push(null);
    } else if (this.code.Next?.OpCodeID == this.OpCodes.ROT_THREE) {
        // double compare case
        this.skipNextJump = true;
        this.code.GoNext();
    } else if (this.dataStack.top() instanceof AST.ASTChainStore) {
        let chainstore = this.dataStack.pop();
        this.dataStack.push(this.dataStack.top());
        this.dataStack.push(chainstore);
    } else {
        this.dataStack.push(this.dataStack.top());
        let node = new AST.ASTChainStore ([], this.dataStack.top());
        this.dataStack.push(node);
    }
}

function handleDupTopTwo() {
    let first = this.dataStack.pop();
    let second = this.dataStack.top();

    this.dataStack.push(first);
    this.dataStack.push(second);
    this.dataStack.push(first);
}

function handleDupTopxA() {
    let first = [];
    let second = [];

    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        let node = this.dataStack.pop();
        first.push(node);
        second.push(node);
    }

    while (first.length) {
        this.dataStack.push(first.pop());
    }

    while (second.length) {
        this.dataStack.push(second.pop());
    }
}

function handleRotTwo() {
    let one = this.dataStack.pop();
    if (this.dataStack.top() instanceof AST.ASTChainStore) {
        this.dataStack.pop();
    }
    let two = this.dataStack.pop();

    this.dataStack.push(one);
    this.dataStack.push(two);
}

function handleRotThree() {
        let one = this.dataStack.pop();
        let two = this.dataStack.pop();
        if (this.dataStack.top() instanceof AST.ASTChainStore) {
            this.dataStack.pop();
        }
        let three = this.dataStack.pop();
        this.dataStack.push(one);
        this.dataStack.push(three);
        this.dataStack.push(two);
    }

function handleRotFour() {
    let one = this.dataStack.pop();
    let two = this.dataStack.pop();
    let three = this.dataStack.pop();
    if (this.dataStack.top() instanceof AST.ASTChainStore) {
        this.dataStack.pop();
    }
    let four = this.dataStack.pop();
    this.dataStack.push(one);
    this.dataStack.push(four);
    this.dataStack.push(three);
    this.dataStack.push(two);
}

function handlePushNull() {
    this.dataStack.push(null);
}

function handleCache() {
    /* These "fake" opcodes are used as placeholders for optimizing
       certain opcodes in Python 3.11+.  Since we have no need for
       that during disassembly/decompilation, we can just treat these
       as no-ops. */
}

function handleNop() {}

module.exports = {
    handleDupTop,
    handleDupTopTwo,
    handleDupTopxA,    
    handleRotTwo,
    handleRotThree,
    handleRotFour,
    handlePushNull,
    handleCache,
    handleNop
};