"""Read the central directory of a remote zip with range requests; write path → [offset, csize, usize, method]."""
import json
import struct
import sys
import urllib.request

TAIL = 70000  # the end record is 22 bytes and its comment at most 65535


def index(read, total):
    """The files of a zip of `total` bytes; `read(a, b)` returns bytes a..b, both included."""
    start = max(0, total - TAIL)
    tail = read(start, total - 1)
    i = tail.rfind(b"PK\x05\x06")
    if i < 0:
        raise ValueError("no end of central directory record: not a zip, or cut short")
    n, cdsize, cdoff = struct.unpack("<HII", tail[i + 10 : i + 20])
    cd = read(cdoff, cdoff + cdsize - 1)
    out, p = {}, 0
    for _ in range(n):
        if cd[p : p + 4] != b"PK\x01\x02":
            raise ValueError(f"central directory entry expected at byte {p}")
        (method,) = struct.unpack("<H", cd[p + 10 : p + 12])
        csize, usize, nl, el, cl = struct.unpack("<IIHHH", cd[p + 20 : p + 34])
        (off,) = struct.unpack("<I", cd[p + 42 : p + 46])
        out[cd[p + 46 : p + 46 + nl].decode()] = [off, csize, usize, method]
        p += 46 + nl + el + cl
    return out


def main(url, path):
    def read(a, b):
        r = urllib.request.Request(url, headers={"Range": f"bytes={a}-{b}"})
        with urllib.request.urlopen(r) as f:
            return f.read()

    with urllib.request.urlopen(urllib.request.Request(url, headers={"Range": "bytes=0-0"})) as f:
        total = int(f.headers["Content-Range"].split("/")[1])
    files = index(read, total)
    with open(path, "w") as f:
        json.dump({"total": total, "files": files}, f)
    print(total, len(files))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
