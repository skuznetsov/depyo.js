class OpCode {
    OpCodeID = 0;
    InstructionName = null;
    HasArgument = false;
    Argument = 0;
    HasName = false;
    Name = null;
    HasJumpRelative = false;
    HasJumpAbsolute = false;
    HasConstant = false;
    Constant = null;
    ConstantObject = null;
    HasCompare = false;
    CompareOperator = null;
    HasLocal = false;
    LocalName = null;
    HasFree = false;
    FreeName = null;
    Offset = 0;

    get JumpTarget () {
        if (this.HasJumpRelative) {
            return this.Offset + 3 + this.Argument;
        } else if (this.HasJumpAbsolute) {
            return this.Argument;
        } else {
            return 0;
        }
    }

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

    Clone() {
        let clone = new OpCode();
        for (let [key, value] of Object.entries(this)) {
            clone[key] = value;
        }
        return clone;
    }
}

module.exports = OpCode;
