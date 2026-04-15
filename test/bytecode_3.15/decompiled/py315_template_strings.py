def fmt(name, count):
    s1 = t"hello {name}"; s2 = t"value={count!r:>10}"; s3 = t"sum: {count + 1}"
    return (s1, s2,
        s3)
