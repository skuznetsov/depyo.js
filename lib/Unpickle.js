// public class Unpickle
// {
//     public static List<object> Load(string fileName)
//     {
//         List<object> result = null;
//         BinaryReader rdr = new BinaryReader(File.OpenRead(fileName));

//         result = Load(rdr);


//         return result;
//     }

//     public static List<object> Load(byte[] data)
//     {
//         MemoryStream memStream = new MemoryStream(data);
//         BinaryReader rdr = new BinaryReader(memStream);
//         return Load(rdr);
//     }

//     public static List<object> Load(BinaryReader rdr)
//     {
//         List<object> result = new List<object>();
//         List<object> memo = new List<object>();

//         while (rdr.BaseStream.Position < rdr.BaseStream.Length)
//         {

//             byte opCode = rdr.ReadByte();

//             switch ((char)opCode)
//             {
//                 case '(': // MARK
//                     break;
//                 case '.': // STOP
//                     break;
//                 case '0': // POP
//                     break;
//                 case '1': // POP_MARK
//                     break;
//                 case '2': // DUP
//                     break;
//                 case 'F': // FLOAT
//                     break;
//                 case 'I': // INT
//                     break;
//                 case 'J': // BININT
//                     result.Add(rdr.ReadInt32());
//                     break;
//                 case 'K': // BININT1
//                     result.Add(rdr.ReadByte());
//                     break;
//                 case 'L': // LONG
//                     break;
//                 case 'M': // BININT2
//                     result.Add(rdr.ReadInt16());
//                     break;
//                 case 'N': // NONE
//                     break;
//                 case 'P': // PERSID
//                     rdr.ReadByte();
//                     break;
//                 case 'Q': // BINPERSID
//                     break;
//                 case 'R': // REDUCE
//                     break;
//                 case 'S': // STRING
//                     break;
//                 case 'T': // BINSTRING
//                     int size = rdr.ReadInt32();
//                     result.Add(rdr.ReadBytes(size));
//                     break;
//                 case 'U': // SHORT_BINSTRING
//                     int uSize = (int)rdr.ReadByte();
//                     result.Add(rdr.ReadBytes(uSize));
//                     break;
//                 case 'V': // UNICODE
//                     break;
//                 case 'X': // BINUNICODE
//                     uSize = (int)rdr.ReadByte();
//                     result.Add(rdr.ReadBytes(uSize));
//                     break;
//                 case 'a': // APPEND
//                     break;
//                 case 'b': // BUILD
//                     break;
//                 case 'c': // GLOBAL
//                     break;
//                 case 'd': // DICT
//                     break;
//                 case '}': // EMPTY_DICT
//                     break;
//                 case 'e': // APPENDS
//                     break;
//                 case 'g': // GET
//                     break;
//                 case 'h': // BINGET
//                     int idx = rdr.ReadByte();
//                     if (idx < memo.Count)
//                         result.Add(memo[idx]);
//                     break;
//                 case 'i': // INST
//                     break;
//                 case 'j': // LONG_BINGET
//                     idx = rdr.ReadInt32();
//                     break;
//                 case 'l': // LIST
//                     break;
//                 case ']': // EMPTY_LIST
//                     break;
//                 case 'o': // OBJ
//                     break;
//                 case 'p': // PUT
//                     break;
//                 case 'q': // BINPUT
//                     idx = rdr.ReadByte();
//                     break;
//                 case 'r': // LONG_BINPUT
//                     idx = rdr.ReadInt32();
//                     break;
//                 case 's': // SETITEM
//                     break;
//                 case 't': // TUPLE
//                     break;
//                 case ')': // EMPTY_TUPLE
//                     break;
//                 case 'u': // SETITEMS
//                     break;
//                 case 'G': // BINFLOAT
//                     result.Add(rdr.ReadDouble());
//                     break;
//                 case '\x80': // PROTO
//                     rdr.ReadByte();
//                     break;
//                 case '\x81': // NEWOBJ
//                     break;
//                 case '\x82': // EXT1
//                     break;
//                 case '\x83': // EXT2
//                     break;
//                 case '\x84': // EXT4
//                     break;
//                 case '\x85': // TUPLE1
//                     break;
//                 case '\x86': // TUPLE2
//                     break;
//                 case '\x87': // TUPLE3
//                     break;
//                 case '\x88': // NEWTRUE
//                     result.Add(true);
//                     break;
//                 case '\x89': // NEWFALSE
//                     result.Add(false);
//                     break;
//                 case '\x8A': // LONG1
//                     idx = rdr.ReadByte();
//                     result.Add(rdr.ReadBytes(idx));
//                     break;
//                 case '\x8B': // LONG4
//                     idx = rdr.ReadInt32();
//                     result.Add(rdr.ReadBytes(idx));
//                     break;
//                 case '\x9D':
//                     rdr.ReadBytes(1);
//                     break;
//                 default:
//                     throw new ArgumentOutOfRangeException();
//             }
//         }

//         return result;
//     }
// }
