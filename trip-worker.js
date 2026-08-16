/* =========================================================
   人狼オンライン トリップ検索 Worker
   ========================================================= */

"use strict";

let cryptReady = false;

/*
 * 同じフォルダの unix-crypt-td.min.js を読み込む
 * GitHub Pages / localhost の HTTP 配信なら正常に動作します。
 */
try {
    importScripts("./unix-crypt-td.min.js");

    if (typeof unixCryptTD === "function") {
        cryptReady = true;
        postMessage({
            type: "ready"
        });
    } else {
        throw new Error("unixCryptTD が定義されていません");
    }

} catch (e) {

    postMessage({
        type: "error",
        message:
            "unix-crypt-td.min.js の読み込みに失敗しました。\n" +
            "Workerの場所: " + self.location.href + "\n" +
            "エラー: " + e.message
    });
}


/* =========================================================
   トリップ生成
   ========================================================= */

function saltForTrip(key) {
    let s = (key + "H.").slice(1, 3);

    s = s.replace(/[^\.-z]/g, ".");

    s = s.replace(/[\:;<=>?@[\\\]^_`]/g, function (c) {

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

    if (!cryptReady || typeof unixCryptTD !== "function") {
        throw new Error("unixCryptTD unavailable");
    }

    return "◆" +
        unixCryptTD(
            key,
            saltForTrip(key)
        ).slice(-10);
}


/* =========================================================
   特殊トリップ判定
   ========================================================= */

function pureN(t) {

    let max = 1;
    let current = 1;

    for (let i = 1; i < t.length; i++) {

        if (t[i] === t[i - 1]) {
            current++;
            if (current > max) max = current;
        } else {
            current = 1;
        }
    }

    return max;
}


function quasiN(t) {

    let max = 1;
    let current = 1;

    for (let i = 1; i < t.length; i++) {

        if (
            t[i].toLowerCase() ===
            t[i - 1].toLowerCase()
        ) {
            current++;
            if (current > max) max = current;
        } else {
            current = 1;
        }
    }

    return max;
}


function isNStructure(t) {

    return new Set(t.split("")).size <= 2;
}


function isLongest(t) {

    return /^[MmW]+$/.test(t);
}


function isShortest(t) {

    return /^[li.]+$/.test(t);
}


function isYakumo(t) {

    /*
     * 3文字ずつ同じ文字
     *
     * 例:
     * aaa
     * ttt
     * www
     * + 余り1文字
     */

    const usable = t.length - (t.length % 3);

    if (usable < 3) return false;

    for (let i = 0; i < usable; i += 3) {

        if (
            t[i] !== t[i + 1] ||
            t[i] !== t[i + 2]
        ) {
            return false;
        }
    }

    return true;
}


function isMirror(t) {

    const pairs = {
        "a": "a",
        "b": "d",
        "d": "b",
        "o": "o",
        "p": "q",
        "q": "p",
        "v": "v",
        "w": "w",
        "x": "x",
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
        "l": "l",
        "i": "i"
    };

    for (let i = 0; i < Math.floor(t.length / 2); i++) {

        const a = t[i];
        const b = t[t.length - 1 - i];

        if (pairs[a] !== b) {
            return false;
        }
    }

    return true;
}


function isPalindrome(t) {

    for (let i = 0; i < Math.floor(t.length / 2); i++) {

        if (
            t[i] !==
            t[t.length - 1 - i]
        ) {
            return false;
        }
    }

    return true;
}


function isEcho(t) {

    if (t.length % 2 !== 0) {
        return false;
    }

    const half = t.length / 2;

    return (
        t.slice(0, half) ===
        t.slice(half)
    );
}


function isDoublePair(t) {

    for (let i = 0; i < t.length; i += 2) {

        if (
            t[i] !== t[i + 1]
        ) {
            return false;
        }
    }

    return true;
}


function isAllNumber(t) {

    return /^[0-9]+$/.test(t);
}


function isTobiishi(t) {

    for (let i = 0; i < t.length; i++) {

        if (
            i % 2 === 0
        ) {
            continue;
        }

        if (
            t[i] !== "." &&
            t[i] !== "/"
        ) {
            return false;
        }
    }

    return true;
}


function isKakutobi(t) {

    /*
     * 奇数位置に区切りとして
     * 同じ文字が入るタイプ
     */

    if (t.length < 4) return false;

    const separator = t[1];

    for (let i = 1; i < t.length; i += 2) {

        if (t[i] !== separator) {
            return false;
        }
    }

    return true;
}


/* =========================================================
   特殊トリップ総合判定
   ========================================================= */

function specialMatches(t, type) {

    switch (type) {

        case "pure8":
            return pureN(t) >= 8;

        case "pure9":
            return pureN(t) >= 9;

        case "pure10":
            return pureN(t) >= 10;

        case "quasi9":
            return quasiN(t) >= 9;

        case "quasi10":
            return quasiN(t) >= 10;

        case "two":
            return isNStructure(t);

        case "longest":
            return isLongest(t);

        case "shortest":
            return isShortest(t);

        case "yakumo":
            return isYakumo(t);

        case "mirror":
            return isMirror(t);

        case "palindrome":
            return isPalindrome(t);

        case "echo":
            return isEcho(t);

        case "double":
            return isDoublePair(t);

        case "number":
            return isAllNumber(t);

        case "tobiishi":
            return isTobiishi(t);

        case "kakutobi":
            return isKakutobi(t);

        default:
            return true;
    }
}


/* =========================================================
   正規表現
   ========================================================= */

function regexMatches(t, pattern) {

    try {

        const re = new RegExp(pattern);

        return re.test(t);

    } catch (e) {

        return false;
    }
}


/* =========================================================
   通常条件
   ========================================================= */

function normalMatches(t, needles) {

    return needles.every(function (n) {

        if (!n.text) {
            return true;
        }

        if (n.regex) {
            return regexMatches(
                t,
                n.text
            );
        }

        if (n.mode === "prefix") {
            return t.startsWith(n.text);
        }

        if (n.mode === "suffix") {
            return t.endsWith(n.text);
        }

        return t.includes(n.text);
    });
}


/* =========================================================
   Worker
   ========================================================= */

let stopped = false;

self.onmessage = function (event) {

    const data = event.data;

    if (data.cmd === "stop") {

        stopped = true;

        return;
    }

    if (data.cmd !== "start") {
        return;
    }

    if (!cryptReady) {

        postMessage({
            type: "error",
            message:
                "unixCryptTD unavailable"
        });

        return;
    }

    stopped = false;

    const chars =
        data.chars;

    const len =
        data.remainingLen;

    const prefix =
        data.prefix || "";

    const maxAttempts =
        data.maxAttempts;

    const unlimited =
        data.unlimited === true;

    const needles =
        data.needles || [];

    const special =
        data.special || "none";

    let attempts = 0;
    let found = 0;

    const startTime =
        performance.now();


    function keyFromIndex(index) {

        let out = "";

        for (
            let i = 0;
            i < len;
            i++
        ) {

            out =
                chars[index % chars.length] +
                out;

            index =
                Math.floor(
                    index / chars.length
                );
        }

        return out;
    }


    /*
     * 全探索空間
     *
     * 10^10 などは Number の
     * 安全整数を超える可能性があるため
     * 実際の停止条件は unlimited /
     * maxAttempts で管理する。
     */

    let limit;

    if (unlimited) {

        limit = Number.MAX_SAFE_INTEGER;

    } else {

        limit =
            Math.min(
                Number.MAX_SAFE_INTEGER,
                Math.max(1, maxAttempts)
            );
    }


    for (
        let index = 0;
        index < limit;
        index++
    ) {

        if (stopped) {
            break;
        }

        const key =
            prefix +
            keyFromIndex(index);

        let trip;

        try {

            trip =
                makeTrip(key);

        } catch (e) {

            postMessage({
                type: "error",
                message: e.message
            });

            return;
        }

        attempts++;


        /*
         * 通常条件
         */

        let normalOK =
            normalMatches(
                trip.slice(1),
                needles
            );


        /*
         * 特殊トリップ
         */

        let specialOK = true;

        if (special !== "none") {

            specialOK =
                specialMatches(
                    trip.slice(1),
                    special
                );
        }


        if (
            normalOK &&
            specialOK
        ) {

            found++;

            postMessage({
                type: "hit",
                item: {
                    key: key,
                    trip: trip
                }
            });
        }


        /*
         * 進捗
         */

        if (
            attempts % 1000 === 0
        ) {

            const seconds =
                (performance.now() -
                    startTime) / 1000;

            const rate =
                Math.round(
                    attempts /
                    Math.max(
                        seconds,
                        0.001
                    )
                );

            postMessage({
                type: "progress",
                attempts: attempts,
                rate: rate,
                found: found
            });
        }
    }


    const seconds =
        (performance.now() -
            startTime) / 1000;

    const rate =
        Math.round(
            attempts /
            Math.max(
                seconds,
                0.001
            )
        );


    postMessage({
        type: "done",
        attempts: attempts,
        rate: rate,
        found: found,
        stopped: stopped
    });
};
