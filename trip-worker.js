"use strict";

/*
 * GitHub Pages上の同じフォルダにある
 * unix-crypt-td.min.js を読み込む
 */
importScripts("./unix-crypt-td.min.js");

if (typeof unixCryptTD !== "function") {
  throw new Error("unixCryptTD unavailable");
}

const CHARS =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./";

function saltForTrip(key) {
    let s = (key + "H.").slice(1, 3);

    s = s.replace(/[^\.-z]/g, ".");

    s = s.replace(/[\:;<=>?@[\\\]^_`]/g, c => {
        const table = {
            ":": "A",
            ";": "B",
            "<": "C",
            "=": "D",
            ">": "E",
            "?": "F",
            "@": "G",
            "[": "a",
            "\\": "b",
            "]": "c",
            "^": "d",
            "_": "e",
            "`": "f"
        };

        return table[c] || c;
    });

    return s;
}

function makeTrip(key) {
    if (typeof unixCryptTD !== "function") {
        throw new Error("unixCryptTD unavailable");
    }

    return "◆" +
        unixCryptTD(key, saltForTrip(key)).slice(-10);
}


/* =========================
   特殊トリップ判定
========================= */

function pureN(trip) {
    let max = 1;
    let current = 1;

    for (let i = 1; i < trip.length; i++) {
        if (trip[i] === trip[i - 1]) {
            current++;
            max = Math.max(max, current);
        } else {
            current = 1;
        }
    }

    return max;
}

function quasiN(trip) {
    let max = 1;
    let current = 1;

    for (let i = 1; i < trip.length; i++) {
        if (
            trip[i].toLowerCase() ===
            trip[i - 1].toLowerCase()
        ) {
            current++;
            max = Math.max(max, current);
        } else {
            current = 1;
        }
    }

    return max;
}

function isNType(trip, n, mode) {
    if (mode === "pure") {
        return pureN(trip) >= n;
    }

    if (mode === "quasi") {
        return quasiN(trip) >= n;
    }

    return false;
}

function isTwoStructure(trip) {
    return new Set(trip).size <= 2;
}

function isSaicho(trip) {
    return /^[MmW]+$/.test(trip);
}

function isSaitan(trip) {
    return /^[li.]+$/.test(trip);
}

function isYakumo(trip) {
    /*
     * 3文字ずつ同じ文字
     * 例: aaatttwww + 残り1文字
     */
    const groups = Math.floor(trip.length / 3);

    for (let i = 0; i < groups; i++) {
        const p = i * 3;

        if (
            trip[p] !== trip[p + 1] ||
            trip[p] !== trip[p + 2]
        ) {
            return false;
        }
    }

    return true;
}

function isPalindrome(trip) {
    for (let i = 0; i < Math.floor(trip.length / 2); i++) {
        if (trip[i] !== trip[trip.length - 1 - i]) {
            return false;
        }
    }

    return true;
}

function isMirror(trip) {
    const mirror = {
        ".": ".",
        "0": "0",
        "8": "8",
        "A": "A",
        "H": "H",
        "I": "I",
        "M": "M",
        "O": "O",
        "T": "T",
        "U": "U",
        "V": "V",
        "W": "W",
        "X": "X",
        "Y": "Y",

        "b": "d",
        "d": "b",
        "i": "i",
        "l": "l",
        "o": "o",
        "p": "q",
        "q": "p",
        "v": "v",
        "w": "w"
    };

    for (let i = 0; i < Math.floor(trip.length / 2); i++) {
        const a = trip[i];
        const b = trip[trip.length - 1 - i];

        if (mirror[a] !== b) {
            return false;
        }
    }

    return true;
}

function isYamabiko(trip) {
    if (trip.length % 2 !== 0) {
        return false;
    }

    const half = trip.length / 2;

    return (
        trip.slice(0, half) ===
        trip.slice(half)
    );
}

function isSoren(trip) {
    for (let i = 0; i < trip.length; i += 2) {
        if (trip[i] !== trip[i + 1]) {
            return false;
        }
    }

    return true;
}

function isAllNumber(trip) {
    return /^[0-9]+$/.test(trip);
}

function isTobiishi(trip) {
    for (let i = 1; i < trip.length; i += 2) {
        if (trip[i] !== "." && trip[i] !== "/") {
            return false;
        }
    }

    return true;
}

function isKakutobi(trip) {
    /*
     * oUlUEUDUDU
     *
     * 1文字目と3文字目と5文字目...
     * 2文字目と4文字目と6文字目...
     * がそれぞれ同じ文字
     */

    if (trip.length < 4) {
        return false;
    }

    const a = trip[0];
    const b = trip[1];

    for (let i = 0; i < trip.length; i++) {
        if (i % 2 === 0) {
            if (trip[i] !== a) {
                return false;
            }
        } else {
            if (trip[i] !== b) {
                return false;
            }
        }
    }

    return true;
}

function specialMatch(trip, type, n) {

    switch (type) {

        case "pure":
            return isNType(trip, n || 8, "pure");

        case "quasi":
            return isNType(trip, n || 9, "quasi");

        case "two":
            return isTwoStructure(trip);

        case "saicho":
            return isSaicho(trip);

        case "saitan":
            return isSaitan(trip);

        case "yakumo":
            return isYakumo(trip);

        case "mirror":
            return isMirror(trip);

        case "palindrome":
            return isPalindrome(trip);

        case "yamabiko":
            return isYamabiko(trip);

        case "soren":
            return isSoren(trip);

        case "number":
            return isAllNumber(trip);

        case "tobiishi":
            return isTobiishi(trip);

        case "kakutobi":
            return isKakutobi(trip);

        default:
            return false;
    }
}


/* =========================
   正規表現
========================= */

function regexMatch(trip, pattern, flags) {

    try {
        const re = new RegExp(pattern, flags || "");
        return re.test(trip);
    } catch (e) {
        return false;
    }
}


/* =========================
   通常条件
========================= */

function normalMatch(trip, conditions) {

    return conditions.every(c => {

        const text =
            String(c.text || "")
                .trim()
                .replace(/^◆/, "");

        if (!text) {
            return true;
        }

        if (c.mode === "prefix") {
            return trip.startsWith(text);
        }

        if (c.mode === "suffix") {
            return trip.endsWith(text);
        }

        return trip.includes(text);
    });
}


/* =========================
   総合判定
========================= */

function matches(trip, data) {

    const {
        conditions,
        regex,
        regexFlags,
        special
    } = data;

    if (!normalMatch(trip, conditions || [])) {
        return false;
    }

    if (regex && regex.trim()) {
        if (!regexMatch(trip, regex, regexFlags)) {
            return false;
        }
    }

    if (special && special.type !== "none") {

        if (
            !specialMatch(
                trip,
                special.type,
                Number(special.n) || 1
            )
        ) {
            return false;
        }
    }

    return true;
}


/* =========================
   インデックス → キー
========================= */

function keyFromIndex(index, len) {

    let out = "";

    for (let i = 0; i < len; i++) {

        out =
            CHARS[index % CHARS.length] +
            out;

        index =
            Math.floor(
                index / CHARS.length
            );
    }

    return out;
}


/* =========================
   Worker
========================= */

let stopped = false;

self.onmessage = function (e) {

    const data = e.data;

    if (data.cmd === "stop") {
        stopped = true;
        return;
    }

    if (data.cmd !== "start") {
        return;
    }

    stopped = false;

    const {
        tripLen,
        maxAttempts,
        unlimited,
        conditions,
        regex,
        regexFlags,
        special
    } = data;

    let attempts = 0;
    let found = 0;

    const started =
        performance.now();

    /*
     * 10桁 / 12桁
     *
     * ただし無制限検索の場合は
     * JavaScriptの安全な整数範囲を超えないよう
     * インデックスを順番に増加させる。
     */

    const total =
        Math.pow(
            CHARS.length,
            tripLen
        );

    let limit;

    if (unlimited) {
        limit = Infinity;
    } else {
        limit =
            Math.min(
                total,
                Number(maxAttempts)
            );
    }

    /*
     * 一定数まとめて処理することで
     * postMessage回数を減らして高速化
     */

    const REPORT_EVERY = 5000;

    for (
        let idx = 0;
        idx < limit;
        idx++
    ) {

        if (stopped) {
            break;
        }

        const key =
            keyFromIndex(
                idx,
                tripLen
            );

        let trip;

        try {
            trip = makeTrip(key);
        } catch (err) {

            postMessage({
                type: "error",
                message: err.message
            });

            return;
        }

        attempts++;

        const raw =
            trip.slice(1);

        if (
            matches(
                raw,
                {
                    conditions,
                    regex,
                    regexFlags,
                    special
                }
            )
        ) {

            found++;

            postMessage({
                type: "hit",
                item: {
                    key,
                    trip
                }
            });
        }

        if (
            attempts % REPORT_EVERY === 0
        ) {

            const sec =
                (performance.now() - started) /
                1000;

            postMessage({
                type: "progress",
                attempts,
                rate: Math.round(
                    attempts /
                    Math.max(sec, 0.001)
                ),
                found
            });
        }
    }

    const sec =
        (performance.now() - started) /
        1000;

    postMessage({
        type: "done",
        attempts,
        rate: Math.round(
            attempts /
            Math.max(sec, 0.001)
        ),
        found,
        stopped
    });
};
