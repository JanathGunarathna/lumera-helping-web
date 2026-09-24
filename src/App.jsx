import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState
} from "react";
import {
  Routes, Route, NavLink, useNavigate, useSearchParams
} from "react-router-dom";
import {
  collection, addDoc, getDocs, getDoc, deleteDoc, doc, setDoc, serverTimestamp
} from "firebase/firestore";
import { db, firebaseConfigured, checkFirestoreConnection } from "./firebase";
import {
  Beaker, ChevronRight, CirclePlus, Database, FlaskConical,
  Home, PackagePlus, Trash2, X, Save, Check, Clock, ArrowRight,
  Search, Library, RefreshCw, Circle, DollarSign, TrendingUp
} from "lucide-react";
import "./App.css";

const seedOils = [
  { name: "Bergamot", category: "Top", costPerMl: 0 },
  { name: "Lemon", category: "Top", costPerMl: 0 },
  { name: "Pink Pepper", category: "Top", costPerMl: 0 },
  { name: "Black Pepper", category: "Top", costPerMl: 0 },
  { name: "Peppermint", category: "Top", costPerMl: 0 },
  { name: "Lavender", category: "Heart", costPerMl: 0 },
  { name: "Rose", category: "Heart", costPerMl: 0 },
  { name: "Jasmine", category: "Heart", costPerMl: 0 },
  { name: "Sandalwood", category: "Base", costPerMl: 0 },
  { name: "Vetiver", category: "Base", costPerMl: 0 },
  { name: "Patchouli", category: "Base", costPerMl: 0 },
  { name: "Warm Vanilla", category: "Base", costPerMl: 0 },
  { name: "White Musk", category: "Base", costPerMl: 0 },
  { name: "Iso E Super", category: "Base", costPerMl: 0 }
];

const newTest = (index = 1, oils = seedOils) => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  testName: `New Test ${index}`,
  volume: "10",
  unit: "ml",
  ingredients: [{ oil: oils[0]?.name || "Bergamot", amount: "" }],
  sellingPrice: "",
  saved: false,
  dirty: true
});

function formatDate(value) {
  const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ============================================================
   Shared data layer — one Firestore source of truth for every
   page, with verified writes (read the doc back after saving,
   so a save can never silently disappear).
   ============================================================ */

const DataContext = createContext(null);
const useAppData = () => useContext(DataContext);

function AppDataProvider({ children }) {
  const [oils, setOils] = useState(seedOils);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState("checking"); // checking | connected | error

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const oilSnap = await getDocs(collection(db, "fragranceOils"));
      if (!oilSnap.empty) setOils(oilSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const testSnap = await getDocs(collection(db, "fragranceTests"));
      const list = testSnap.docs.map(d => ({
        id: d.id,
        testName: d.data().testName || "Untitled Test",
        volume: String(d.data().volume ?? 10),
        unit: d.data().unit || "ml",
        ingredients: d.data().ingredients || [],
        sellingPrice: String(d.data().sellingPrice ?? ""),
        totalCost: d.data().totalCost ?? 0,
        updatedAt: d.data().updatedAt,
        saved: true,
        dirty: false
      }));
      list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setSamples(list);
    } catch (e) {
      console.error("[firestore] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    setConnection("checking");
    const ok = await checkFirestoreConnection();
    setConnection(ok ? "connected" : "error");
  }, []);

  useEffect(() => { loadAll(); checkConnection(); }, [loadAll, checkConnection]);

  async function saveSample(test) {
    const ingredients = test.ingredients.filter(r => r.oil && r.amount);
    const totalOil = ingredients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const totalCost = ingredients.reduce((sum, r) => {
      const cost = oils.find(o => o.name === r.oil)?.costPerMl || 0;
      return sum + cost * (parseFloat(r.amount) || 0);
    }, 0);
    const sellingPrice = Number(test.sellingPrice) || 0;
    const localNow = new Date();
    const payload = {
      testName: test.testName.trim(),
      volume: Number(test.volume) || 0,
      unit: test.unit,
      ingredients,
      totalOil: Number(totalOil.toFixed(3)),
      sellingPrice,
      totalCost: Number(totalCost.toFixed(2)),
      profit: Number((sellingPrice - totalCost).toFixed(2)),
      updatedAt: serverTimestamp()
    };

    let savedId = test.id;
    if (test.id.startsWith("draft-")) {
      const ref = await addDoc(collection(db, "fragranceTests"), { ...payload, createdAt: serverTimestamp() });
      savedId = ref.id;
    } else {
      await setDoc(doc(db, "fragranceTests", test.id), payload, { merge: true });
    }

    // Verify: read the document straight back. If this fails, the save did
    // NOT really happen, even though the write call above didn't throw.
    const verify = await getDoc(doc(db, "fragranceTests", savedId));
    if (!verify.exists()) {
      throw new Error("Save was not confirmed by the database.");
    }

    const finalized = {
      ...test, ...payload, sellingPrice: String(sellingPrice), updatedAt: localNow,
      id: savedId, saved: true, dirty: false
    };
    setSamples(v => [finalized, ...v.filter(s => s.id !== savedId && s.id !== test.id)]);
    return finalized;
  }

  async function deleteSample(id) {
    await deleteDoc(doc(db, "fragranceTests", id));
    setSamples(v => v.filter(s => s.id !== id));
  }

  async function addOil(name, category, costPerMl = 0) {
    const item = { name: name.trim(), category, costPerMl: Number(costPerMl) || 0, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, "fragranceOils"), item);
    const verify = await getDoc(doc(db, "fragranceOils", ref.id));
    if (!verify.exists()) throw new Error("Save was not confirmed by the database.");
    const saved = { id: ref.id, ...item };
    setOils(v => [...v, saved]);
    return saved;
  }

  async function deleteOil(id) {
    await deleteDoc(doc(db, "fragranceOils", id));
    setOils(v => v.filter(o => o.id !== id));
  }

  const value = {
    oils, samples, loading, connection,
    refresh: loadAll, checkConnection,
    saveSample, deleteSample, addOil, deleteOil
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/* ============================================================
   Shell
   ============================================================ */

function ConnectionPill() {
  const { connection, checkConnection } = useAppData();
  const label = connection === "connected" ? "Database connected"
    : connection === "checking" ? "Checking connection…"
    : "Database unreachable";
  return <button className={`connection-pill ${connection}`} onClick={checkConnection} title="Click to re-check">
    <Circle size={8} fill="currentColor"/> {label}
  </button>;
}

function Layout({ children }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">L</div>
        <div className="brand-text"><b>Luméra</b><span>Fragrance Lab</span></div>
      </div>
      <nav>
        <NavLink to="/" end><Home size={18}/> Dashboard</NavLink>
        <NavLink to="/oils"><Database size={18}/> Fragrance Oils</NavLink>
        <NavLink to="/tests"><FlaskConical size={18}/> Fragrance Tests</NavLink>
        <NavLink to="/samples"><Library size={18}/> Samples Library</NavLink>
      </nav>
      <div className="side-footer">
        <ConnectionPill/>
        <p>Create a formula, save it, retrieve it any time.</p>
      </div>
    </aside>
    <main className="main">
      {!firebaseConfigured && (
        <div className="setup-banner">
          <b>Firebase isn't configured.</b> Add a <code>.env</code> file with your
          <code>VITE_FIREBASE_*</code> keys and restart the dev server — nothing will save until then.
        </div>
      )}
      {children}
    </main>
  </div>;
}

/* ============================================================
   Dashboard
   ============================================================ */

function Dashboard() {
  const navigate = useNavigate();
  const { oils, samples, loading, connection } = useAppData();
  const lastSample = samples[0];

  return <section>
    <div className="hero">
      <div>
        <div className="kicker">Luméra Fragrance</div>
        <h1>The formula notebook for your fragrance lab</h1>
        <p>Keep a library of fragrance oils, build several test formulas side by side, and come back to every sample you've ever mixed.</p>
      </div>
      <button className="primary" onClick={() => navigate("/tests")}>
        <Beaker size={18}/> Open the lab
      </button>
    </div>

    <div className="stat-row">
      <div className="stat-tile">
        <span>Fragrance oils</span>
        <b>{loading ? "—" : oils.length}</b>
      </div>
      <div className="stat-tile">
        <span>Saved samples</span>
        <b>{loading ? "—" : samples.length}</b>
      </div>
      <div className="stat-tile">
        <span>Last saved</span>
        <b>{loading ? "—" : lastSample ? formatDate(lastSample.updatedAt) : "None yet"}</b>
      </div>
      <div className={`stat-tile status-${connection}`}>
        <span>Database</span>
        <b>{connection === "connected" ? "Online" : connection === "checking" ? "Checking…" : "Offline"}</b>
      </div>
    </div>

    <div className="cards">
      <div className="card">
        <PackagePlus/>
        <h3>Add fragrance oils</h3>
        <p>Keep the oils you have on hand in one library, sorted by top, heart and base notes.</p>
        <button onClick={() => navigate("/oils")}>Manage oils <ChevronRight size={16}/></button>
      </div>
      <div className="card">
        <FlaskConical/>
        <h3>Create fragrance tests</h3>
        <p>Draft several formulas at once, tune the ratios, and save each one on its own.</p>
        <button onClick={() => navigate("/tests")}>Open tests <ChevronRight size={16}/></button>
      </div>
      <div className="card">
        <Library/>
        <h3>Browse saved samples</h3>
        <p>Every saved test lives in your library, searchable, any time you need it back.</p>
        <button onClick={() => navigate("/samples")}>Open library <ChevronRight size={16}/></button>
      </div>
    </div>
  </section>;
}

/* ============================================================
   Oils
   ============================================================ */

function Oils() {
  const { oils, loading, addOil, deleteOil } = useAppData();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Top");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addOil(name, category, cost);
      setName("");
      setCost("");
    } catch (err) {
      console.error(err);
      alert("Could not save this oil — the database did not confirm the write. Check your Firebase setup and security rules.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Remove this oil from your library?")) return;
    try {
      await deleteOil(id);
    } catch {
      alert("Could not remove this oil.");
    }
  }

  const grouped = ["Top", "Heart", "Base"].map(cat => ({
    cat, items: oils.filter(o => o.category === cat)
  }));

  return <section>
    <Header title="Fragrance oils" subtitle="Build the library you'll draw from when you formulate a test."/>
    <div className="grid-2">
      <form className="panel" onSubmit={submit}>
        <h2>Add a fragrance oil</h2>
        <label>Oil name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Oud" required/>
        </label>
        <label>Note category
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option>Top</option><option>Heart</option><option>Base</option>
          </select>
        </label>
        <label>Cost per ml <span className="label-optional">(optional)</span>
          <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00"/>
        </label>
        <button className="primary" type="submit" disabled={saving}>
          <CirclePlus size={18}/> {saving ? "Adding…" : "Add oil"}
        </button>
        <p className="hint">Saved straight to your Firestore oil library, verified on write.</p>
      </form>
      <div className="panel">
        <div className="panel-head"><h2>Oil library</h2><span>{oils.length} oils</span></div>
        {loading ? <p className="muted">Loading your library…</p> : oils.length === 0 ? (
          <p className="muted">No oils yet — add your first one.</p>
        ) : (
          <div className="oil-groups">
            {grouped.map(g => g.items.length > 0 && (
              <div className="oil-group" key={g.cat}>
                <div className={`note-tag note-${g.cat.toLowerCase()}`}>{g.cat} notes</div>
                <div className="oil-list">
                  {g.items.map(o => <div className="oil-row" key={o.id || o.name}>
                    <span>{o.name}</span>
                    <span className="oil-row-right">
                      {o.costPerMl > 0 && <span className="oil-cost">${Number(o.costPerMl).toFixed(2)}/ml</span>}
                      {o.id && <button className="icon-btn danger" onClick={() => remove(o.id)} title="Remove oil"><Trash2 size={15}/></button>}
                    </span>
                  </div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>;
}

/* ============================================================
   Tests workspace — create & edit formulas
   ============================================================ */

function TestsWorkspace() {
  const { oils, samples, loading, saveSample } = useAppData();
  const [openTests, setOpenTests] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // If we arrived from the Samples Library with ?open=<id>, open that sample.
  useEffect(() => {
    const wantId = searchParams.get("open");
    if (!wantId || loading) return;
    const sample = samples.find(s => s.id === wantId);
    if (sample && !openTests.find(t => t.id === wantId)) {
      const copy = { ...sample, ingredients: sample.ingredients.map(r => ({ ...r })), dirty: false };
      setOpenTests(v => [...v, copy]);
      setActiveId(wantId);
    } else if (sample) {
      setActiveId(wantId);
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, samples]);

  function createTest() {
    const draft = newTest(openTests.length + 1, oils);
    setOpenTests(v => [...v, draft]);
    setActiveId(draft.id);
  }

  function openSample(sample) {
    const already = openTests.find(t => t.id === sample.id);
    if (already) { setActiveId(sample.id); return; }
    const copy = { ...sample, ingredients: sample.ingredients.map(r => ({ ...r })), dirty: false };
    setOpenTests(v => [...v, copy]);
    setActiveId(sample.id);
  }

  function updateTest(id, patch) {
    setOpenTests(v => v.map(t => t.id === id ? { ...t, ...patch, dirty: true, saved: false } : t));
  }

  function closeTest(id) {
    const target = openTests.find(t => t.id === id);
    if (target?.dirty && !confirm("This test has unsaved changes. Close it anyway?")) return;
    const remaining = openTests.filter(t => t.id !== id);
    setOpenTests(remaining);
    if (activeId === id) setActiveId(remaining[remaining.length - 1]?.id || null);
  }

  async function handleSave(test) {
    if (!test.testName.trim()) {
      alert("Enter a test name before saving.");
      return;
    }
    try {
      const finalized = await saveSample(test);
      setOpenTests(v => v.map(t => t.id === test.id ? finalized : t));
      setActiveId(finalized.id);
    } catch (e) {
      console.error(e);
      alert("Could not save this test — the database did not confirm the write. Check the connection status in the sidebar and your Firestore security rules.");
    }
  }

  const active = openTests.find(t => t.id === activeId);
  const recent = samples.slice(0, 6);

  return <section>
    <div className="page-header">
      <div>
        <div className="kicker">Luméra Lab</div>
        <h1>Fragrance tests</h1>
        <p>Draft new formulas or reopen a sample you've saved before.</p>
      </div>
      <button className="primary" onClick={createTest}><CirclePlus size={18}/> New test</button>
    </div>

    <div className="samples-panel">
      <div className="panel-head">
        <h2>Recent samples</h2>
        <NavLink to="/samples" className="panel-link">View all <ArrowRight size={14}/></NavLink>
      </div>
      {loading ? <p className="muted">Loading your samples…</p> : recent.length === 0 ? (
        <p className="muted">Nothing saved yet — create a test below and save it to see it here.</p>
      ) : (
        <div className="sample-grid">
          {recent.map(s => (
            <button className="sample-card" key={s.id} onClick={() => openSample(s)}>
              <div className="sample-top">
                <span className="sample-name">{s.testName}</span>
                <ArrowRight size={15}/>
              </div>
              <div className="sample-meta">
                <span>{s.volume} {s.unit}</span>
                <span>{s.ingredients.length} oil{s.ingredients.length === 1 ? "" : "s"}</span>
                <span><Clock size={12}/> {formatDate(s.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>

    {openTests.length > 0 && (
      <div className="test-tabs">
        {openTests.map(t => (
          <div className={`test-tab ${activeId === t.id ? "active" : ""}`} key={t.id} onClick={() => setActiveId(t.id)}>
            <div className="tab-status">{t.saved && !t.dirty ? <Check size={13}/> : <span className="dot"/>}</div>
            <div className="tab-name">{t.testName || "Untitled Test"}</div>
            <button className="tab-close" onClick={e => { e.stopPropagation(); closeTest(t.id); }}><X size={14}/></button>
          </div>
        ))}
      </div>
    )}

    {!active ? (
      <div className="empty-tests">
        <FlaskConical size={34}/>
        <h2>No test is open</h2>
        <p>Start a new formula, or open one of your saved samples above.</p>
        <button className="primary" onClick={createTest}><CirclePlus size={18}/> Create a test</button>
      </div>
    ) : <TestEditor
      test={active}
      oils={oils}
      onChange={patch => updateTest(active.id, patch)}
      onSave={() => handleSave(active)}
    />}
  </section>;
}

function TestEditor({ test, oils, onChange, onSave }) {
  const [tab, setTab] = useState("formula");
  const total = useMemo(() => test.ingredients.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0), [test.ingredients]);

  function categoryFor(oilName) {
    return oils.find(o => o.name === oilName)?.category || "Top";
  }

  function costOf(oilName, amount) {
    const cost = oils.find(o => o.name === oilName)?.costPerMl || 0;
    return cost * (parseFloat(amount) || 0);
  }

  const totalCost = useMemo(
    () => test.ingredients.reduce((sum, r) => sum + costOf(r.oil, r.amount), 0),
    [test.ingredients, oils]
  );
  const sellingPrice = parseFloat(test.sellingPrice) || 0;
  const profit = sellingPrice - totalCost;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  function updateIngredient(index, key, value) {
    onChange({ ingredients: test.ingredients.map((r, i) => i === index ? { ...r, [key]: value } : r) });
  }

  function addIngredient() {
    onChange({ ingredients: [...test.ingredients, { oil: oils[0]?.name || "Bergamot", amount: "" }] });
  }

  function removeIngredient(index) {
    onChange({ ingredients: test.ingredients.filter((_, i) => i !== index) });
  }

  return <div className="panel wide test-editor">
    <div className="editor-top">
      <div>
        <div className="kicker">Active formula</div>
        <h2>{test.testName}</h2>
      </div>
      <div className={`save-state ${test.saved && !test.dirty ? "saved" : ""}`}>
        {test.saved && !test.dirty ? <><Check size={15}/> Saved</> : "Unsaved changes"}
      </div>
    </div>

    <div className="form-grid">
      <label>Test name
        <input value={test.testName} onChange={e => onChange({ testName: e.target.value })} placeholder="e.g. Summer Bloom V1"/>
      </label>
      <label>Final volume
        <div className="inline">
          <input type="number" min="0" step="0.1" value={test.volume} onChange={e => onChange({ volume: e.target.value })}/>
          <select value={test.unit} onChange={e => onChange({ unit: e.target.value })}>
            <option>ml</option><option>L</option>
          </select>
        </div>
      </label>
    </div>

    <div className="editor-tabs">
      <button className={`editor-tab ${tab === "formula" ? "active" : ""}`} onClick={() => setTab("formula")}>
        <FlaskConical size={15}/> Formula
      </button>
      <button className={`editor-tab ${tab === "pricing" ? "active" : ""}`} onClick={() => setTab("pricing")}>
        <DollarSign size={15}/> Pricing
      </button>
    </div>

    {tab === "formula" ? <>
      <div className="section-title">
        <h2>Fragrance oils</h2>
        <button className="secondary" onClick={addIngredient}><CirclePlus size={17}/> Add oil</button>
      </div>

      <div className="ingredient-head"><span>Oil</span><span>Amount (ml)</span><span></span></div>

      {test.ingredients.length === 0 ? (
        <p className="muted ingredient-empty">No oils added yet — add one to start the formula.</p>
      ) : test.ingredients.map((r, i) => {
        const cat = categoryFor(r.oil);
        return <div className={`ingredient-row ingredient-${cat.toLowerCase()}`} key={`${test.id}-${i}`}>
          <select value={r.oil} onChange={e => updateIngredient(i, "oil", e.target.value)}>
            {oils.map((o, oi) => <option key={o.id || `${o.name}-${oi}`} value={o.name}>{o.name}</option>)}
          </select>
          <input type="number" min="0" step="0.01" value={r.amount} onChange={e => updateIngredient(i, "amount", e.target.value)} placeholder="0.00"/>
          <button className="icon-btn danger" onClick={() => removeIngredient(i)} title="Remove oil"><Trash2 size={16}/></button>
        </div>;
      })}

      <div className="test-summary">
        <div><span>Total oil</span><b>{total.toFixed(2)} ml</b></div>
        <div><span>Target volume</span><b>{test.volume || "0"} {test.unit}</b></div>
        <div><span>Remaining</span><b>{Math.max((parseFloat(test.volume) || 0) - total, 0).toFixed(2)} ml</b></div>
      </div>
    </> : <>
      <div className="section-title">
        <h2>Cost breakdown</h2>
      </div>

      {test.ingredients.filter(r => r.oil && r.amount).length === 0 ? (
        <p className="muted ingredient-empty">Add oils on the Formula tab to see a cost breakdown here.</p>
      ) : (
        <div className="pricing-breakdown">
          {test.ingredients.filter(r => r.oil && r.amount).map((r, i) => (
            <div className="pricing-row" key={i}>
              <span>{r.oil}</span>
              <span className="muted">{r.amount} ml</span>
              <span>Rs.{costOf(r.oil, r.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <label className="selling-price-field">
        Selling price <span className="label-optional">(per finished bottle)</span>
        <div className="inline">
          <span className="prefix">Rs.</span>
          <input type="number" min="0" step="0.01" value={test.sellingPrice}
            onChange={e => onChange({ sellingPrice: e.target.value })} placeholder="0.00"/>
        </div>
      </label>

      <div className="test-summary pricing-summary">
        <div><span>Ingredient cost</span><b>Rs.{totalCost.toFixed(2)}</b></div>
        <div><span>Selling price</span><b>Rs.{sellingPrice.toFixed(2)}</b></div>
        <div className={profit >= 0 ? "profit-positive" : "profit-negative"}>
          <span>Profit</span><b><TrendingUp size={14}/> Rs.{profit.toFixed(2)} {sellingPrice > 0 && `(Rs.{margin.toFixed(0)}%)`}</b>
        </div>
      </div>
      {oils.some(o => !o.costPerMl) && (
        <p className="hint">Tip: set a cost per ml on your oils in the Fragrance Oils library for a more accurate cost.</p>
      )}
    </>}

    <div className="actions">
      <button className="primary" onClick={onSave}><Save size={18}/> Save test</button>
    </div>
  </div>;
}

/* ============================================================
   Samples Library — retrieve any saved sample, any time
   ============================================================ */

function SamplesLibrary() {
  const { samples, loading, deleteSample, refresh } = useAppData();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const filtered = samples.filter(s => s.testName.toLowerCase().includes(query.trim().toLowerCase()));

  async function remove(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this saved sample? This can't be undone.")) return;
    try {
      await deleteSample(id);
    } catch {
      alert("Could not delete this sample.");
    }
  }

  return <section>
    <div className="page-header">
      <div>
        <div className="kicker">Luméra Lab</div>
        <h1>Samples library</h1>
        <p>Every formula you've saved, all in one place — search, reopen, or remove any of them.</p>
      </div>
      <button className="secondary" onClick={refresh}><RefreshCw size={16}/> Refresh</button>
    </div>

    <div className="search-bar">
      <Search size={16}/>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search saved samples by name…"
      />
    </div>

    {loading ? <p className="muted">Loading your samples…</p> : filtered.length === 0 ? (
      <div className="empty-tests">
        <Library size={34}/>
        <h2>{query ? "No matches" : "Nothing saved yet"}</h2>
        <p>{query ? "Try a different search term." : "Create and save a test to see it appear here."}</p>
        {!query && <button className="primary" onClick={() => navigate("/tests")}><CirclePlus size={18}/> Create a test</button>}
      </div>
    ) : (
      <div className="library-grid">
        {filtered.map(s => (
          <div className="library-card" key={s.id} onClick={() => navigate(`/tests?open=${s.id}`)}>
            <div className="library-card-top">
              <h3>{s.testName}</h3>
              <button className="icon-btn danger" onClick={e => remove(e, s.id)} title="Delete sample"><Trash2 size={16}/></button>
            </div>
            <div className="library-oils">
              {s.ingredients.slice(0, 4).map((ing, i) => <span className="chip" key={i}>{ing.oil}</span>)}
              {s.ingredients.length > 4 && <span className="chip muted-chip">+{s.ingredients.length - 4} more</span>}
            </div>
            <div className="sample-meta">
              <span>{s.volume} {s.unit}</span>
              <span>{s.ingredients.length} oil{s.ingredients.length === 1 ? "" : "s"}</span>
              <span><Clock size={12}/> {formatDate(s.updatedAt)}</span>
              {Number(s.sellingPrice) > 0 && <span className="price-chip"><DollarSign size={11}/> {Number(s.sellingPrice).toFixed(2)}</span>}
            </div>
            <div className="library-open">Open to edit <ArrowRight size={14}/></div>
          </div>
        ))}
      </div>
    )}
  </section>;
}

function Header({ title, subtitle }) {
  return <div className="page-header"><div><div className="kicker">Luméra Lab</div><h1>{title}</h1><p>{subtitle}</p></div></div>;
}

export default function App() {
  return <AppDataProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/oils" element={<Oils/>}/>
        <Route path="/tests" element={<TestsWorkspace/>}/>
        <Route path="/samples" element={<SamplesLibrary/>}/>
      </Routes>
    </Layout>
  </AppDataProvider>;
}