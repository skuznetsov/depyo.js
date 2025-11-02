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
    } else if (this.code.Next?.OpCodeID == this.OpCodes.LOAD_ATTR_A) {
        // Augmented assign on attribute (a.value += 1)
        // Don't create ChainStore - just duplicate the value
        this.dataStack.push(this.dataStack.top());
    } else {
        // Check if this is a walrus operator pattern:
        // DUP_TOP → STORE_* → <not another STORE>
        let nextOpCode = this.code.Next?.OpCodeID;
        let isStoreOp = (nextOpCode == this.OpCodes.STORE_NAME_A ||
                         nextOpCode == this.OpCodes.STORE_FAST_A ||
                         nextOpCode == this.OpCodes.STORE_GLOBAL_A);

        if (isStoreOp && this.code.Next?.Next) {
            let afterStoreOpCode = this.code.Next.Next.OpCodeID;
            let isAnotherStore = (afterStoreOpCode == this.OpCodes.STORE_NAME_A ||
                                  afterStoreOpCode == this.OpCodes.STORE_FAST_A ||
                                  afterStoreOpCode == this.OpCodes.STORE_GLOBAL_A ||
                                  afterStoreOpCode == this.OpCodes.STORE_ATTR_A ||
                                  afterStoreOpCode == this.OpCodes.STORE_DEREF_A);

            if (!isAnotherStore) {
                // This is a walrus operator (named expression)
                // Don't duplicate - just set flag. The value will be wrapped in ASTNamedExpr.
                this.isWalrusOperator = true;
                return;
            }
        }

        // If next opcode is NOT a store operation, this is just a temporary copy
        // (e.g., for match/case pattern matching) - don't create ChainStore
        if (!isStoreOp) {
            this.dataStack.push(this.dataStack.top());
            return;
        }

        // Regular chained assignment (a = b = 10)
        this.dataStack.push(this.dataStack.top());
        let node = new AST.ASTChainStore ([], this.dataStack.top());
        this.dataStack.push(node);
    }
}

function handleCopyA() {
    // COPY opcode (Python 3.11+): copies the i-th item to the top of the stack
    // Argument specifies which item: 1 = top, 2 = second, etc.
    let depth = this.code.Current.Argument;
    if (depth == 1) {
        // COPY 1 is equivalent to DUP_TOP - same walrus detection logic
        handleDupTop.call(this);
    } else {
        // For other depths, just copy the item
        let index = this.dataStack.size() - depth;
        if (index >= 0 && index < this.dataStack.size()) {
            this.dataStack.push(this.dataStack[index]);
        }
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

function handleSwapA() {
    // Python 3.11+ SWAP opcode: swaps i-th item with TOS
    // Argument specifies depth: 2 = swap top 2, 3 = swap TOS with 3rd, etc.
    let depth = this.code.Current.Argument;

    if (depth == 2) {
        // SWAP 2: swap top two items
        handleRotTwo.call(this);
    } else if (depth == 3) {
        // SWAP 3: swap TOS with third item
        let one = this.dataStack.pop();
        let two = this.dataStack.pop();
        let three = this.dataStack.pop();

        this.dataStack.push(one);
        this.dataStack.push(two);
        this.dataStack.push(three);
    } else {
        // General case: swap TOS with i-th item
        let tos = this.dataStack.pop();
        let index = this.dataStack.length - (depth - 1);
        if (index >= 0) {
            let temp = this.dataStack[index];
            this.dataStack[index] = tos;
            this.dataStack.push(temp);
        }
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
    handleCopyA,
    handleDupTopTwo,
    handleDupTopxA,
    handleSwapA,
    handleRotTwo,
    handleRotThree,
    handleRotFour,
    handlePushNull,
    handleCache,
    handleNop
};