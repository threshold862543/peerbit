/* 

MIT License

Copyright (c) 2020 Vlad Tansky
Copyright (c) 2022 dao.xyz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

const _perfomancePolyfill = () => {
	// based on https://gist.github.com/paulirish/5438650 copyright Paul Irish 2015.
	if ("performance" in window === false) {
		(window.performance as any) = {};
	}

	Date.now =
		Date.now ||
		(() => {
			// thanks IE8
			return new Date().getTime();
		});

	if ("now" in window.performance === false) {
		let nowOffset = Date.now();

		if (performance.timing && performance.timing.navigationStart) {
			nowOffset = performance.timing.navigationStart;
		}

		window.performance.now = () => Date.now() - nowOffset;
	}
};

const _hrtime = (previousTimestamp?: [number, number]): [number, number] => {
	_perfomancePolyfill();
	const baseNow = Math.floor((Date.now() - performance.now()) * 1e-3);
	const clocktime = performance.now() * 1e-3;
	let seconds = Math.floor(clocktime) + baseNow;
	let nanoseconds = Math.floor((clocktime % 1) * 1e9);

	if (previousTimestamp) {
		seconds = seconds - previousTimestamp[0];
		nanoseconds = nanoseconds - previousTimestamp[1];
		if (nanoseconds < 0) {
			seconds--;
			nanoseconds += 1e9;
		}
	}
	return [seconds, nanoseconds];
};
const NS_PER_SEC = 1e9;
_hrtime.bigint = (time?: [number, number]): bigint => {
	const diff = _hrtime(time);
	return BigInt(diff[0] * NS_PER_SEC + diff[1]);
};

export default typeof process === "undefined" ||
typeof process.hrtime === "undefined"
	? _hrtime
	: process.hrtime;
