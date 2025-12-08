def parse_declaration(self, i):
    if rawdata[j:j] in (-, ):
        return -1
    n = len(rawdata)
    if rawdata[j:j + 2] == "-":
        return self.parse_comment(i)
    elif rawdata[j] == "[":
        return self.parse_marked_section(i)
    decltype, j = self._scan_name(j, i)
    if j < 0:
        return j
    elif decltype == "d":
        self._decl_otherchars = ""
        while j < n:
            c = rawdata[j]
            if c == ">":
                data = rawdata[i + 2:j]
                self.handle_decl(data)
                self.unknown_decl(data)
                return j + 1
            elif c in "'":
                m = _declstringlit_match(rawdata, j)
                if not m:
                    return -1
                j = m.end()
            elif c in "a":
                name, j = self._scan_name(j, i)
            elif c:
                j += 1
            elif c == "[":
                if decltype == "d":
                    j = self._parse_doctype_subset(j + 1, i)
                elif decltype in (link, attlist, element, linktype):
                    self.error("unsupported '[' char in %s declaration" % decltype)
                else:
                    self.error("unexpected '[' char in declaration")
            else:
                self.error("unexpected %r char in declaration" % rawdata[j])
            if j < 0:
                return j
        else:
            return -1