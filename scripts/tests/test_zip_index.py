"""The remote zip index: the central directory, read through a fake range reader."""
import io
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import zip_index  # noqa: E402


def archive(files, compression=zipfile.ZIP_DEFLATED):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression) as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


def reader(data, calls=None):
    def read(a, b):
        if calls is not None:
            calls.append((a, b))
        return data[a : b + 1]

    return read


def test_index_matches_what_zipfile_reads():
    data = archive({"a.txt": b"hello " * 50, "dir/b.bin": bytes(range(256))})
    got = zip_index.index(reader(data), len(data))
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        want = {i.filename: [i.header_offset, i.compress_size, i.file_size, i.compress_type] for i in z.infolist()}
    assert got == want


def test_stored_files_keep_method_zero_and_equal_sizes():
    data = archive({"s.txt": b"abc"}, zipfile.ZIP_STORED)
    assert zip_index.index(reader(data), len(data)) == {"s.txt": [0, 3, 3, 0]}


def test_a_small_archive_is_not_read_before_its_first_byte():
    data = archive({"a": b"x"})
    calls = []
    zip_index.index(reader(data, calls), len(data))
    assert all(a >= 0 for a, _ in calls)


def test_only_the_tail_and_the_directory_are_read_of_a_large_archive():
    import os

    data = archive({"big": os.urandom(300_000), "z": b"end"}, zipfile.ZIP_STORED)
    calls = []
    zip_index.index(reader(data, calls), len(data))
    assert sum(b - a + 1 for a, b in calls) < 80_000


def test_no_end_record_is_an_error_that_says_so():
    import pytest

    with pytest.raises(ValueError, match="end of central directory"):
        zip_index.index(reader(b"x" * 100), 100)
