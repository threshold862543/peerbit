import { Routes } from "../routes";
import crypto from "crypto";

describe("routes", () => {
	/* 

	We create this in the setup
	┌─┐
	│y│
	└┬┘
	┌▽┐
	│x│
	└─┘ 

	┌─┐
	│a│
	└┬┘
	┌▽┐
	│b│
	└┬┘
	┌▽┐   
	│c│   
	└─┘   

	and conenct x and a during the tests
	
	*/

	let routes: Routes;
	let a: string, b: string, c: string, x: string, y: string;

	const set = () => {
		a = crypto.randomBytes(16).toString("hex");
		b = crypto.randomBytes(16).toString("hex");
		c = crypto.randomBytes(16).toString("hex");
		x = crypto.randomBytes(16).toString("hex");
		y = crypto.randomBytes(16).toString("hex");
	};
	beforeEach(() => {
		routes = new Routes("_");
		set();
		expect(routes.addLink(a, b)).toContainAllValues([]);
		expect(routes.addLink(b, c)).toContainAllValues([]);
		expect(routes.addLink(x, y)).toContainAllValues([]);
	});
	describe("path", () => {
		it("will find path", () => {
			const path = routes.getPath(a, c);
			expect(path.map((x) => x.id.toString())).toEqual([a, b, c]);
		});

		it("missing node", () => {
			const path = routes.getPath(a, "?");
			expect(path).toHaveLength(0);
		});
		it("missing path", () => {
			const path = routes.getPath(a, x);
			expect(path).toHaveLength(0);
		});
	});

	describe("add", () => {
		it("insertion symmetric", () => {
			const ab = routes.getLink(a, b);
			const ba = routes.getLink(b, a);
			expect(ab).toBeDefined();
			expect(ba).toBeDefined();
		});
	});

	describe("delete", () => {
		it("single", () => {
			expect(routes.deleteLink(b, a)).toEqual([]); // netiher a or b was reachablee (because of origin arg)
			expect(routes.getPath(a, c)).toHaveLength(0);
		});

		it("symmetric", () => {
			routes.addLink(b, a);
			expect(routes.deleteLink(b, a)).toEqual([]); // netiher a or b was reachablee (because of origin arg)
			expect(routes.getPath(a, c)).toHaveLength(0);
		});

		it("subgraph 1", () => {
			expect(routes.addLink(a, x, x)).toEqual([a, b, c]);
			expect(routes.getPath(x, c).length === 4);
			expect(routes.linksCount).toEqual(4);

			expect(routes.deleteLink(a, x, x)).toEqual([a, b, c]);
			expect(routes.linksCount).toEqual(1); // x -> y
			expect(routes.getLink(x, y)).toBeDefined();
		});

		it("subgraph 2", () => {
			expect(routes.addLink(a, x, x)).toEqual([a, b, c]);
			expect(routes.getPath(x, c).length === 4);
			expect(routes.linksCount).toEqual(4);

			expect(routes.deleteLink(a, b, x)).toEqual([b, c]);
			expect(routes.linksCount).toEqual(2); // x -> y
			expect(routes.getLink(x, a)).toBeDefined();
			expect(routes.getLink(x, y)).toBeDefined();
		});

		it("subgraph 3", () => {
			expect(routes.addLink(a, x, y)).toEqual([a, b, c]);
			expect(routes.getPath(x, c).length === 4);
			expect(routes.linksCount).toEqual(4);

			expect(routes.deleteLink(a, b, y)).toEqual([b, c]);
			expect(routes.linksCount).toEqual(2); // x -> a x -> y
			expect(routes.getLink(x, a)).toBeDefined();
			expect(routes.getLink(x, y)).toBeDefined();
		});
	});
});
