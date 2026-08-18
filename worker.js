"use strict";


/*
 * =========================================================
 * 人狼オンライン トリップ検索 Worker
 *
 * 必要ファイル:
 *
 *   ./unix-crypt-td.min.js
 *
 * 10桁:
 *   Unix crypt
 *   → crypt結果の末尾10文字
 *
 * 12桁:
 *   SHA-1
 *   → Base64
 *   → + を .
 *   → 先頭12文字
 *
 * =========================================================
 */


let crypt = null;

let running = false;


/* =========================================================
   初期化
========================================================= */

try {

    importScripts(
        "./unix-crypt-td.min.js"
    );


    if (
        typeof self.unixCryptTD ===
        "function"
    ) {

        crypt =
            self.unixCryptTD;

    } else if (
        typeof self.z ===
        "function"
    ) {

        crypt =
            self.z;

    } else {

        throw new Error(
            "unixCryptTD / z が見つかりません"
        );
    }


    self.postMessage({
        type: "ready"
    });


} catch (e) {

    self.postMessage({

        type: "error",

        message:
            getErrorMessage(e)

    });
}


/* =========================================================
   エラー文字列
========================================================= */

function getErrorMessage(e) {

    if (
        e &&
        e.stack
    ) {

        return e.stack;
    }


    if (
        e &&
        e.message
    ) {

        return e.message;
    }


    return String(e);
}


/* =========================================================
   メッセージ
========================================================= */

self.onmessage =
function(event) {

    const data =
        event.data || {};


    /* -----------------------------------------
       停止
    ----------------------------------------- */

    if (
        data.type === "stop"
    ) {

        running = false;


        self.postMessage({

            type: "stopped"

        });


        return;
    }


    /* -----------------------------------------
       テスト
    ----------------------------------------- */

    if (
        data.type === "test"
    ) {

        runTests();

        return;
    }


    /* -----------------------------------------
       生成
    ----------------------------------------- */

    if (
        data.type === "generate"
    ) {

        generateTrip(data);

        return;
    }


    /* -----------------------------------------
       検索
    ----------------------------------------- */

    if (
        data.type === "search"
    ) {

        if (
            typeof crypt !==
            "function"
        ) {

            self.postMessage({

                type: "error",

                message:
                    "unixCryptTD unavailable"

            });

            return;
        }


        running = true;


        search(data);


        return;
    }
};


/* =========================================================
   トリップ生成
========================================================= */

async function generateTrip(data) {

    try {

        const length =
            Number(data.length) === 12
                ? 12
                : 10;


        let key =
            String(
                data.key || ""
            );


        /*
         * # が入力されていても除去
         */

        if (
            key.startsWith("#")
        ) {

            key =
                key.substring(1);
        }


        let trip;


        /*
         * 12桁
         */

        if (
            length === 12
        ) {

            trip =
                await makeTrip12(
                    key
                );

        } else {

            /*
             * 10桁
             */

            trip =
                makeTrip10(
                    key
                );
        }


        /*
         * 表示用キー
         */

        let displayKey;


        if (
            length === 10
        ) {

            displayKey =
                "#" +
                key.substring(
                    0,
                    8
                ) +
                "..";

        } else {

            displayKey =
                "#" +
                key.substring(
                    0,
                    12
                );
        }


        /*
         * ★index.html と一致する
         *   generate-result
         */

        self.postMessage({

            type: "generate-result",

            key:
                displayKey,

            rawKey:
                key,

            trip:
                trip,

            length:
                length
        });


    } catch (e) {

        self.postMessage({

            type: "error",

            message:
                getErrorMessage(e)

        });
    }
}


/* =========================================================
   10桁
========================================================= */

function makeTrip10(key) {

    if (
        typeof crypt !==
        "function"
    ) {

        throw new Error(
            "unixCryptTD unavailable"
        );
    }


    key =
        String(key);


    /*
     * #除去
     */

    if (
        key.startsWith("#")
    ) {

        key =
            key.substring(1);
    }


    /*
     * 先頭8文字
     */

    const password =
        key.substring(
            0,
            8
        );


    /*
     * salt
     */

    let saltSource =
        (
            key +
            "H."
        ).substring(
            1,
            3
        );


    /*
     * 2ch系salt変換
     */

    saltSource =
        saltSource.replace(
            /[^\.-z]/g,
            "."
        );


    const from =
        ":;<=>?@[\\]^_`";


    const to =
        "ABCDEFGabcdef";


    let salt = "";


    for (
        let i = 0;
        i < saltSource.length;
        i++
    ) {

        const ch =
            saltSource.charAt(i);


        const pos =
            from.indexOf(ch);


        if (
            pos >= 0
        ) {

            salt +=
                to.charAt(pos);

        } else {

            salt += ch;
        }
    }


    /*
     * 2文字保証
     */

    if (
        salt.length < 2
    ) {

        salt =
            (
                salt +
                "H."
            ).substring(
                0,
                2
            );
    }


    const result =
        crypt(
            password,
            salt
        );


    if (
        typeof result !==
        "string"
    ) {

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }


    /*
     * 末尾10文字
     */

    return result.slice(
        -10
    );
}


/* =========================================================
   12桁
========================================================= */

async function makeTrip12(key) {

    key =
        String(key);


    if (
        key.startsWith("#")
    ) {

        key =
            key.substring(1);
    }


    /*
     * UTF-8
     */

    const data =
        new TextEncoder()
            .encode(key);


    /*
     * SHA-1
     */

    const digest =
        await crypto.subtle.digest(
            "SHA-1",
            data
        );


    const bytes =
        new Uint8Array(
            digest
        );


    /*
     * binary
     */

    let binary = "";


    for (
        let i = 0;
        i < bytes.length;
        i++
    ) {

        binary +=
            String.fromCharCode(
                bytes[i]
            );
    }


    /*
     * Base64
     */

    let base64 =
        btoa(binary);


    /*
     * 12桁トリップ用
     *
     * + → .
     */

    base64 =
        base64.replace(
            /\+/g,
            "."
        );


    /*
     * 先頭12文字
     */

    return base64.substring(
        0,
        12
    );
}


/* =========================================================
   汎用
========================================================= */

async function makeTrip(
    key,
    length
) {

    if (
        Number(length) === 12
    ) {

        return await makeTrip12(
            key
        );
    }


    return makeTrip10(
        key
    );
}


/* =========================================================
   自動検証
========================================================= */

async function runTests() {

    try {

        const testKeys = [

            "foob",

            "Jim",

            "aaaaaaaa",

            "test",

            "abcdefghijkl"

        ];


        const results = [];


        for (
            const key of testKeys
        ) {

            let trip10 = "";

            let trip12 = "";


            /*
             * 10桁
             */

            try {

                trip10 =
                    makeTrip10(
                        key
                    );

            } catch (e) {

                trip10 =
                    "ERROR: " +
                    getErrorMessage(e);
            }


            /*
             * 12桁
             */

            try {

                trip12 =
                    await makeTrip12(
                        key
                    );

            } catch (e) {

                trip12 =
                    "ERROR: " +
                    getErrorMessage(e);
            }


            results.push({

                key:
                    key,

                raw:
                    key,

                trip10:
                    trip10,

                trip12:
                    trip12

            });
        }


        self.postMessage({

            type:
                "test-results",

            results:
                results

        });


    } catch (e) {

        self.postMessage({

            type:
                "error",

            message:
                getErrorMessage(e)

        });
    }
}


/* =========================================================
   検索
========================================================= */

async function search(data) {

    const length =
        Number(data.length) === 12
            ? 12
            : 10;


    const conditions =
        Array.isArray(
            data.conditions
        )
            ? data.conditions
            : [];


    const special =
        data.special ||
        "none";


    const charset =
        data.charset ||
        (
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "abcdefghijklmnopqrstuvwxyz" +
            "0123456789" +
            "./!@#$%^&*()_+-=[]{}<>?"
        );


    let count = 0;


    /* =====================================================
       12桁
    ===================================================== */

    if (
        length === 12
    ) {

        while (running) {

            const key =
                randomKey(
                    charset,
                    12
                );


            let trip;


            try {

                trip =
                    await makeTrip12(
                        key
                    );

            } catch (e) {

                self.postMessage({

                    type:
                        "error",

                    message:
                        getErrorMessage(e)

                });


                running = false;

                return;
            }


            count++;


            if (
                matchesConditions(
                    trip,
                    conditions
                ) &&
                matchesSpecial(
                    trip,
                    special
                )
            ) {

                self.postMessage({

                    type:
                        "hit",

                    key:
                        "#" +
                        key,

                    trip:
                        trip

                });
            }


            if (
                (count & 2047) === 0
            ) {

                self.postMessage({

                    type:
                        "progress",

                    count:
                        2048

                });


                await Promise.resolve();
            }
        }


        self.postMessage({

            type:
                "stopped"

        });


        return;
    }


    /* =====================================================
       10桁
    ===================================================== */

    while (running) {

        const key =
            randomKey(
                charset,
                8
            );


        let trip;


        try {

            trip =
                makeTrip10(
                    key
                );

        } catch (e) {

            self.postMessage({

                type:
                    "error",

                message:
                    getErrorMessage(e)

            });


            running = false;

            return;
        }


        count++;


        if (
            matchesConditions(
                trip,
                conditions
            ) &&
            matchesSpecial(
                trip,
                special
            )
        ) {

            self.postMessage({

                type:
                    "hit",

                key:
                    "#" +
                    key +
                    "..",

                trip:
                    trip

            });
        }


        if (
            (count & 2047) === 0
        ) {

            self.postMessage({

                type:
                    "progress",

                count:
                    2048

            });
        }
    }


    self.postMessage({

        type:
            "stopped"

    });
}


/* =========================================================
   ランダムキー
========================================================= */

function randomKey(
    charset,
    length
) {

    const result = [];


    const size =
        charset.length;


    const max =
        256 -
        (
            256 % size
        );


    while (
        result.length <
        length
    ) {

        const buffer =
            new Uint8Array(
                64
            );


        crypto.getRandomValues(
            buffer
        );


        for (
            let i = 0;
            i < buffer.length &&
            result.length < length;
            i++
        ) {

            const value =
                buffer[i];


            if (
                value >= max
            ) {

                continue;
            }


            result.push(
                charset[
                    value % size
                ]
            );
        }
    }


    return result.join("");
}


/* =========================================================
   通常条件
========================================================= */

function matchesConditions(
    trip,
    conditions
) {

    for (
        const condition of conditions
    ) {

        if (!condition) {
            continue;
        }


        const text =
            String(
                condition.text || ""
            );


        if (!text) {
            continue;
        }


        /*
         * 正規表現
         */

        if (
            condition.regex
        ) {

            try {

                const re =
                    new RegExp(
                        text
                    );


                if (
                    !re.test(trip)
                ) {

                    return false;
                }

            } catch (e) {

                return false;
            }


            continue;
        }


        const mode =
            condition.mode ||
            "contains";


        if (
            mode === "contains" &&
            !trip.includes(text)
        ) {

            return false;
        }


        if (
            mode === "starts" &&
            !trip.startsWith(text)
        ) {

            return false;
        }


        if (
            mode === "ends" &&
            !trip.endsWith(text)
        ) {

            return false;
        }


        if (
            mode === "exact" &&
            trip !== text
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   特殊トリップ
========================================================= */

function matchesSpecial(
    s,
    type
) {

    switch (type) {

        case "none":
        case "":
            return true;

        case "pure":
            return pureN(s);

        case "quasi":
            return quasiN(s);

        case "two":
            return twoKind(s);

        case "longest":
            return /^[MmW]+$/.test(s);

        case "shortest":
            return /^[li.]+$/.test(s);

        case "yakumo":
            return yakumo(s);

        case "mirror":
            return mirror(s);

        case "palindrome":
            return palindrome(s);

        case "echo":
            return echo(s);

        case "double":
            return doublePair(s);

        case "numbers":
            return numbers(s);

        case "tobiishi":
            return tobiishi(s);

        case "kakutobi":
            return kakutobi(s);

        default:
            return true;
    }
}


/* =========================================================
   純n連
========================================================= */

function pureN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i] ===
            s[i - 1]
        ) {

            count++;


            if (
                count >= 8
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================================
   準n連
========================================================= */

function quasiN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i].toLowerCase() ===
            s[i - 1].toLowerCase()
        ) {

            count++;


            if (
                count >= 9
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================================
   二構
========================================================= */

function twoKind(s) {

    return new Set(s).size <= 2;
}


/* =========================================================
   八雲
========================================================= */

function yakumo(s) {

    if (
        s.length < 6
    ) {

        return false;
    }


    const groups =
        Math.floor(
            s.length / 3
        );


    if (
        groups < 2
    ) {

        return false;
    }


    for (
        let i = 0;
        i < groups * 3;
        i += 3
    ) {

        if (
            s[i] !==
            s[i + 1] ||
            s[i] !==
            s[i + 2]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   鏡
========================================================= */

function mirror(s) {

    const pair = {

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


    for (
        let i = 0;
        i < s.length;
        i++
    ) {

        const left =
            s[i];


        const right =
            s[
                s.length -
                1 -
                i
            ];


        if (
            pair[left] !==
            right
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   回文
========================================================= */

function palindrome(s) {

    for (
        let i = 0;
        i <
        Math.floor(
            s.length / 2
        );
        i++
    ) {

        if (
            s[i] !==
            s[
                s.length -
                1 -
                i
            ]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   山彦
========================================================= */

function echo(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    const half =
        s.length / 2;


    return (
        s.substring(
            0,
            half
        ) ===
        s.substring(
            half
        )
    );
}


/* =========================================================
   双連
========================================================= */

function doublePair(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    for (
        let i = 0;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !==
            s[i + 1]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   全数
========================================================= */

function numbers(s) {

    return /^[0-9]+$/.test(s);
}


/* =========================================================
   飛石
========================================================= */

function tobiishi(s) {

    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !== "." &&
            s[i] !== "/"
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   拡飛
========================================================= */

function kakutobi(s) {

    if (
        s.length < 2
    ) {

        return false;
    }


    const separator =
        s[1];


    if (
        separator !== "." &&
        separator !== "/"
    ) {

        return false;
    }


    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !==
            separator
        ) {

            return false;
        }
    }


    return true;
}
