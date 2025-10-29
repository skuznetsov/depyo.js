class OpCode {
    OpCodeID = 0;
    InstructionName = null;
    HasArgument = false;
    Argument = 0;
    HasName = false;
    Name = null;
    HasJumpRelative = false;
    HasJumpAbsolute = false;
    HasNegativeOffset = false;
    HasConstant = false;
    Constant = null;
    ConstantObject = null;
    HasCompare = false;
    CompareOperator = null;
    HasLocal = false;
    LocalName = null;
    HasBinaryOp = false;
    BinaryOp = null;
    HasIntrisic1 = false;
    Intrisic1 = null;
    HasIntrisic2 = false;
    Intrisic2 = null;
    HasFree = false;
    FreeName = null;
    Offset = 0;
    LineNo = 0;
    CodeBlock = null;
    InstructionIndex = -1;
    Size = 2;  // Default size for Python 3.6+ word-aligned instructions

    constructor(opcode, name, opts) {
        this.OpCodeID = opcode;
        this.InstructionName = name;

        if (opts && typeof(opts) == "object") {
            for (let [key, value] of Object.entries(opts)) {
                if (key in this) {
                    this[key] = value;
                }
            }
        }

    }

    get Prev() {
        if (!this.CodeBlock || this.InstructionIndex < 1) {
            return null;
        }
        return this.CodeBlock.Instructions[this.InstructionIndex - 1];
    }

    get Next() {
        if (!this.CodeBlock || this.InstructionIndex < 0 || this.InstructionIndex >= this.CodeBlock.Instructions.length - 1) {
            return null;
        }
        return this.CodeBlock.Instructions[this.InstructionIndex + 1];
    }

    get JumpTarget () {
        if (this.HasJumpRelative) {
            // Python < 3.6: 3-byte instructions (opcode + 2 arg bytes)
            // Python 3.6+: 2-byte instructions (opcode + arg byte)
            return this.Offset + this.Size + this.Argument;
        } else if (this.HasJumpAbsolute) {
            return this.Argument;
        } else {
            return 0;
        }
    }

    get Label() {
        return this.Name || this.LocalName || this.FreeName;
    }

    Clone() {
        let clone = new OpCode();
        for (let [key, value] of Object.entries(this)) {
            clone[key] = value;
        }
        return clone;
    }
}

module.exports = OpCode;

// Registering classes in global scope for propoer class deserialization.
for (let className of Object.keys(module.exports)) {
    global[className] = new module.exports[className]();
}
