"""Read the central directory of a remote zip with range requests; write path → [offset, csize, usize, method]."""
import json, struct, sys, urllib.request
url = sys.argv[1]
def rng(a, b):
    r = urllib.request.Request(url, headers={"Range": f"bytes={a}-{b}"})
    with urllib.request.urlopen(r) as f: return f.read(), f.headers.get("Content-Range")
with urllib.request.urlopen(urllib.request.Request(url, headers={"Range": "bytes=0-0"})) as f:
    total = int(f.headers["Content-Range"].split("/")[1])
tail, _ = rng(total - 70000, total - 1)
i = tail.rfind(b"PK\x05\x06")
n, cdsize, cdoff = struct.unpack("<HII", tail[i+10:i+20])
cd, _ = rng(cdoff, cdoff + cdsize - 1)
out, p = {}, 0
for _ in range(n):
    assert cd[p:p+4] == b"PK\x01\x02"
    method, = struct.unpack("<H", cd[p+10:p+12])
    csize, usize, nl, el, cl = struct.unpack("<IIHHH", cd[p+20:p+34])
    off, = struct.unpack("<I", cd[p+42:p+46])
    name = cd[p+46:p+46+nl].decode()
    out[name] = [off, csize, usize, method]
    p += 46 + nl + el + cl
json.dump({"total": total, "files": out}, open(sys.argv[2], "w"))
print(total, n)
