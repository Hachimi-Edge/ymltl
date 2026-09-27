const STORAGE_KEYS = {
	sessionItems: "ymltl_session_items",
	filename: "ymltl_filename",
	tlChosen: "ymltl_tl_chosen",
	masterFilename: "ymltl_master_filename",
	currentPath: "ymltl_current_path",
	masterContent: "ymltl_master_content"
};

function flattenYAML(src, output, prefix) {
	for(const key in src) {
		const nextPath = prefix ? `${prefix}.${key}` : key;
		if(typeof src[key] === "object" && src[key] !== null) {
			flattenYAML(src[key], output, nextPath);
		} else {
			output[nextPath] = String(src[key] ?? "");
		}
	}
}

function translatorApp() {
	return {
		items: [],
		filter: "all",
		masterContent: null,
		tlContent: null,
		masterFileName: "",
		tlFileName: "target.yml",
		tlFileChosen: false,
		currentPath: "",
		visualSource: true,
		navOpen: false,
		navSearch: "",
		navPage: 1,
		navPageSize: 100,
		busy: false,

		init() {
			if("serviceWorker" in navigator) {
				navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
			}

			if(localStorage.getItem(STORAGE_KEYS.sessionItems)) {
				this.showBusy(() => this.loadPersistedData());
			}
		},

		async showBusy(work) {
			if(this.busy) {
				work();
				return;
			}
			this.busy = true;
			await new Promise(resolve => {
				requestAnimationFrame(() => setTimeout(resolve, 0));
			});
			try {
				work();
			} finally {
				this.busy = false;
			}
		},

		get hasMasterFile() {
			return this.masterContent !== null;
		},

		get masterFileLabel() {
			return this.masterFileName ? `Selected: ${this.masterFileName}` : "No file chosen";
		},

		get tlFileLabel() {
			return this.tlFileChosen ? `Selected: ${this.tlFileName}` : "No file chosen";
		},

		get sessionFilesLabel() {
			const source = this.masterFileName || "none";
			const tl = this.tlFileChosen ? this.tlFileName : "none";
			return `Source: ${source} / TL: ${tl}`;
		},

		get viewToggleLabel() {
			return this.visualSource ? "View: Icons" : "View: Raw";
		},

		get visibleItem() {
			return this.items.find(item => item.path === this.currentPath) || this.items[0] || null;
		},

		get keyIndex() {
			if(!this.visibleItem) return -1;
			return this.items.findIndex(item => item.path === this.visibleItem.path);
		},

		get hasPrevKey() {
			return this.keyIndex > 0;
		},

		get hasNextKey() {
			return this.keyIndex >= 0 && this.keyIndex < this.items.length - 1;
		},

		get keyPositionLabel() {
			if(this.keyIndex < 0) return "";
			return `${this.keyIndex + 1} / ${this.items.length}`;
		},

		get buttonLabelAll() {
			return `All (${this.items.length})`;
		},

		get buttonLabelMissing() {
			const count = this.items.filter(item => !item.target.trim()).length;
			return `Missing (${count})`;
		},

		get buttonLabelDone() {
			const count = this.items.filter(item => item.target.trim()).length;
			return `Done (${count})`;
		},

		get filterClassAll() {
			return this.filter === "all" ? "button-primary" : "";
		},

		get filterClassMissing() {
			return this.filter === "missing" ? "button-primary" : "";
		},

		get filterClassDone() {
			return this.filter === "done" ? "button-primary" : "";
		},

		get statusText() {
			if(this.items.length === 0) return "No active session";
			const done = this.items.filter(item => item.target.trim()).length;
			return `${done} of ${this.items.length} translated`;
		},

		get navButtonLabel() {
			return `Keys (${this.items.length})`;
		},

		get navMatches() {
			let list = this.items;
			if(this.filter === "missing") {
				list = list.filter(item => !item.target.trim());
			} else if(this.filter === "done") {
				list = list.filter(item => item.target.trim());
			}
			const query = this.navSearch.trim().toLowerCase();
			if(!query) return list;
			return list.filter(item => {
				const haystack = `${item.path}\n${item.master}\n${item.target}`.toLowerCase();
				return haystack.includes(query);
			});
		},

		get navPageCount() {
			return Math.max(1, Math.ceil(this.navMatches.length / this.navPageSize));
		},

		get navPageClamped() {
			return Math.min(Math.max(1, this.navPage), this.navPageCount);
		},

		get navItems() {
			const start = (this.navPageClamped - 1) * this.navPageSize;
			return this.navMatches.slice(start, start + this.navPageSize);
		},

		get navCountLabel() {
			const matches = this.navMatches.length;
			if(matches === 0) return "No matches";
			const start = (this.navPageClamped - 1) * this.navPageSize + 1;
			const end = Math.min(this.navPageClamped * this.navPageSize, matches);
			return `Showing ${start}-${end} of ${matches} matches`;
		},

		get navPages() {
			const total = this.navPageCount;
			const current = this.navPageClamped;
			if(total <= 7) {
				const pages = [];
				for(let i = 1; i <= total; i++) pages.push(i);
				return pages;
			}
			const pages = [1];
			const start = Math.max(2, current - 1);
			const end = Math.min(total - 1, current + 1);
			if(start > 2) pages.push("gap");
			for(let i = start; i <= end; i++) pages.push(i);
			if(end < total - 1) pages.push("gap");
			pages.push(total);
			return pages;
		},

		setFilterAll() { this.filter = "all"; },
		setFilterMissing() { this.filter = "missing"; },
		setFilterDone() { this.filter = "done"; },

		setNavPage(page) {
			if(typeof page !== "number") return;
			this.navPage = Math.min(Math.max(1, page), this.navPageCount);
			this.$nextTick(() => {
				if(this.$refs.navList) this.$refs.navList.scrollTop = 0;
			});
		},

		prevNavPage() { this.setNavPage(this.navPageClamped - 1); },
		nextNavPage() { this.setNavPage(this.navPageClamped + 1); },

		openNav() {
			this.navOpen = true;
			this.$nextTick(() => {
				if(this.$refs.navSearch) this.$refs.navSearch.focus();
			});
		},

		closeNav() {
			this.navOpen = false;
		},

		selectKey(path) {
			if(!this.items.some(item => item.path === path)) return;
			this.navOpen = false;
			this.showBusy(() => {
				this.currentPath = path;
				localStorage.setItem(STORAGE_KEYS.currentPath, path);
			});
		},

		prevKey() {
			if(this.hasPrevKey) this.selectKey(this.items[this.keyIndex - 1].path);
		},

		nextKey() {
			if(this.hasNextKey) this.selectKey(this.items[this.keyIndex + 1].path);
		},

		formatDisplay(text) {
			const escaped = String(text)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
			return escaped
				.replace(/\\u[fF]([0-9a-fA-F]{3})(?![0-9a-fA-F])/g, `<i class="fa">&#xf$1;</i>`)
				.replace(/[\uF000-\uF2FF]/g, (ch) => `<i class="fa">&#x${ch.codePointAt(0).toString(16)};</i>`);
		},

		encodeFA(text) {
			return String(text).replace(/[\uF000-\uF2FF]/g, (ch) => {
				return `\\u${ch.codePointAt(0).toString(16).padStart(4, "0")}`;
			});
		},

		decodeEscapes(text) {
			return String(text).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[0abtnvfre"'\\/N_LP0])/g, (match, esc) => {
				if(esc[0] === "u" || esc[0] === "x") {
					return String.fromCharCode(parseInt(esc.slice(1), 16));
				}
				const simple = {
					"0": "\0",
					"a": "\x07",
					"b": "\b",
					"t": "\t",
					"n": "\n",
					"v": "\v",
					"f": "\f",
					"r": "\r",
					"e": "\x1b",
					"\"": "\"",
					"'": "'",
					"/": "/",
					"\\": "\\",
					"N": "\x85",
					"_": "\xA0",
					"L": "\u2028",
					"P": "\u2029"
				};
				return simple[esc];
			});
		},

		async handleMasterFile(event) {
			const file = event.target.files[0];
			if(!file) return;
			this.masterContent = await file.text();
			this.masterFileName = file.name;
			event.target.value = "";
		},

		async handleTlFile(event) {
			const file = event.target.files[0];
			if(!file) return;
			this.tlFileName = file.name;
			this.tlFileChosen = true;
			this.tlContent = await file.text();
			event.target.value = "";
		},

		startTranslating() {
			if(!this.masterContent) return;
			this.showBusy(() => {
				let masterObj = {};
				let tlObj = {};

				try {
					masterObj = YAML.parse(this.masterContent, { uniqueKeys: false }) || {};
				}catch(error) {
					alert(`Could not parse the master YAML file:\n${error.message}`);
					return;
				}

				if(this.tlContent) {
					try {
						tlObj = YAML.parse(this.tlContent, { uniqueKeys: false }) || {};
					}catch(error) {
						alert(`Could not parse the TL YAML file:\n${error.message}`);
						return;
					}
				}

				const flatMaster = {};
				const flatTl = {};

				flattenYAML(masterObj, flatMaster, "");
				flattenYAML(tlObj, flatTl, "");

				this.items = Object.keys(flatMaster).map(path => {
					return {
						path: path,
						master: flatMaster[path],
						target: flatTl[path] || ""
					};
				});

				if(!this.items.some(item => item.path === this.currentPath)) {
					const firstMissing = this.items.find(item => !item.target.trim());
					this.currentPath = firstMissing ? firstMissing.path : (this.items[0] ? this.items[0].path : "");
				}

				this.filter = "all";
				this.navSearch = "";
				this.navPage = 1;
				this.persistData();
			});
		},

		commitTarget(item, event) {
			if(!item) return;
			const normalized = this.encodeFA(event.target.value.replace(/\r\n/g, "\n"));
			if(normalized === item.target) return;
			item.target = normalized;
			this.persistData();
		},

		hasMissingTokens(item) {
			if(!item || !item.target) return false;
			const tokens = item.master.match(/(\{.*?\})|(%\{.*?\})|(%\w+)/g) || [];
			return tokens.some(token => !item.target.includes(token));
		},

		persistData() {
			const data = this.items.map(item => {
				return { path: item.path, master: item.master, target: item.target };
			});

			localStorage.setItem(STORAGE_KEYS.sessionItems, JSON.stringify(data));
			localStorage.setItem(STORAGE_KEYS.filename, this.tlFileName);
			localStorage.setItem(STORAGE_KEYS.tlChosen, this.tlFileChosen ? "1" : "0");
			localStorage.setItem(STORAGE_KEYS.masterFilename, this.masterFileName || "");
			localStorage.setItem(STORAGE_KEYS.currentPath, this.currentPath || "");

			if(this.masterContent !== null) {
				try {
					localStorage.setItem(STORAGE_KEYS.masterContent, this.masterContent);
				}catch(e) {
					console.warn("Master file too large to persist; export after a reload needs a reset");
				}
			}
		},

		loadPersistedData() {
			const cached = localStorage.getItem(STORAGE_KEYS.sessionItems);
			const savedFileName = localStorage.getItem(STORAGE_KEYS.filename);
			if(!cached) return;
			try {
				const parsed = JSON.parse(cached);
				this.items = parsed.map(item => {
					return {
						path: item.path,
						master: item.master,
						target: this.encodeFA(item.target)
					};
				});
				if(savedFileName) this.tlFileName = savedFileName;
				this.tlFileChosen = localStorage.getItem(STORAGE_KEYS.tlChosen) === "1";
				this.masterFileName = localStorage.getItem(STORAGE_KEYS.masterFilename) || "";
				const savedMaster = localStorage.getItem(STORAGE_KEYS.masterContent);
				if(savedMaster !== null) this.masterContent = savedMaster;
				const savedPath = localStorage.getItem(STORAGE_KEYS.currentPath);
				this.currentPath = (savedPath && this.items.some(item => item.path === savedPath))
					? savedPath
					: (this.items[0] ? this.items[0].path : "");
			}catch(e) {
				console.error("Failed to restore cached state");
			}
		},

		resetWorkspace() {
			if(confirm("Reset workspace? All unsaved work will be lost.")) {
				Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
				this.items = [];
				this.masterContent = null;
				this.tlContent = null;
				this.masterFileName = "";
				this.tlFileName = "target.yml";
				this.tlFileChosen = false;
				this.currentPath = "";
				this.filter = "all";
				this.navOpen = false;
				this.navSearch = "";
				this.navPage = 1;
				const masterInput = document.getElementById("master-file");
				const tlInput = document.getElementById("tl-file");
				if(masterInput) masterInput.value = "";
				if(tlInput) tlInput.value = "";
			}
		},

		exportYAML() {
			if(this.items.length === 0) return;
			if(!this.masterContent) {
				alert("The master YAML file is no longer loaded, so its formatting cannot be mirrored. Reset and re-select the files to export.");
				return;
			}
			this.showBusy(() => {
				let doc;
				try {
					doc = YAML.parseDocument(this.masterContent, { uniqueKeys: false });
				}catch(error) {
					alert(`Could not re-parse the master YAML file:\n${error.message}`);
					return;
				}

				const itemsByPath = new Map(this.items.map(item => [item.path, item]));

				const applyToChild = (value, path) => {
					if(!value) return;
					if(value.items) {
						applyTranslations(value, path);
						return;
					}
					if(typeof value.value !== "string") return;
					const item = itemsByPath.get(path);
					if(!item) return;

					if(!item.target.trim()) return;

					value.value = this.decodeEscapes(item.target);
					if(item.target.includes("\\")) {
						value.type = "QUOTE_DOUBLE";
						value.style = "QUOTE_DOUBLE";
					} else if(value.value.indexOf("\n") >= 0) {
						value.type = "BLOCK_LITERAL";
						value.style = "BLOCK_LITERAL";
					}
				};

				const applyTranslations = (node, prefix) => {
					if(!node) return;
					if(node.type === "SEQ") {
						node.items.forEach((child, index) => {
							applyToChild(child, prefix ? `${prefix}.${index}` : String(index));
						});
						return;
					}
					if(!node.items) return;
					node.items.forEach(pair => {
						if(!pair || !pair.key) return;
						const path = prefix ? `${prefix}.${pair.key.value}` : String(pair.key.value);
						applyToChild(pair.value, path);
					});
				};

				applyTranslations(doc.contents, "");

				let raw;
				try {
					raw = doc.toString({ lineWidth: 0, blockQuote: true });
				}catch(error) {
					alert(`Could not serialize the translated YAML:\n${error.message}`);
					return;
				}

				const output = raw.replace(/[\uF000-\uF2FF]/g, (ch) => {
					return `\\u${ch.codePointAt(0).toString(16).padStart(4, "0")}`;
				});

				try {
					const parsed = YAML.parse(output, { uniqueKeys: false }) || {};
					const flat = {};
					flattenYAML(parsed, flat, "");
					const count = Object.keys(flat).length;
					if(count !== this.items.length) {
						throw new Error(`expected ${this.items.length} keys but the output has ${count}`);
					}
				}catch(error) {
					alert(`Export validation failed, download aborted:\n${error.message}`);
					return;
				}

				const blob = new Blob([output], { type: "text/yaml;charset=utf-8" });
				const link = document.createElement("a");
				link.href = URL.createObjectURL(blob);
				link.download = this.tlFileChosen ? this.tlFileName : "target.yml";
				link.click();
				this.persistData();
			});
		}
	};
}
