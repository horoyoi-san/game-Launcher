import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, LoaderCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { HoyoService } from "@bindings/sunbringer-launcher/internal/hoyo-service";

type CatalogItem = {
    id: number;
    name: string;
    imageId: string;
    imagePath: string;
};

type HoyoCatalog = {
    characters: CatalogItem[];
    weapons: CatalogItem[];
    disks: CatalogItem[];
};

type DiskConfig = {
    setId?: number;
    rank: number;
    slot: number;
    mainStat: number;
    subStatIds: number[];
    subStatRolls: number[];
    allowOverLimitRolls: boolean;
};

type SavedDiskSet = {
    id: string;
    name: string;
    setId: number;
    disks: DiskConfig[];
};

type Category = "disks" | "characters" | "weapons";

const SAVED_DISK_SETS_KEY = "hoyoSavedDiskSets";
const TABS: { id: Category; label: string; caption: string }[] = [
    { id: "disks", label: "Drive Discs", caption: "Create a custom disc" },
    { id: "characters", label: "Agents", caption: "Tune an agent's growth" },
    { id: "weapons", label: "W-Engines", caption: "Add and refine an engine" },
];

const STATS = [
    { id: 11103, name: "HP" },
    { id: 11102, name: "% HP" },
    { id: 12103, name: "ATK" },
    { id: 12102, name: "% ATK" },
    { id: 13103, name: "DEF" },
    { id: 13102, name: "% DEF" },
    { id: 23203, name: "PEN" },
    { id: 23103, name: "% PEN" },
    { id: 31402, name: "Anomaly Mastery" },
    { id: 31203, name: "Anomaly Proficiency" },
    { id: 21103, name: "CRIT DMG" },
    { id: 20103, name: "CRIT Rate" },
    { id: 30502, name: "Energy Regen" },
    { id: 12202, name: "Impact" },
    { id: 31803, name: "Electric DMG" },
    { id: 31903, name: "Ether DMG" },
    { id: 31603, name: "Fire DMG" },
    { id: 31703, name: "Ice DMG" },
    { id: 31503, name: "Physical DMG" },
    { id: 32303, name: "Wind DMG" },
];

const SUBSTAT_IDS = [11103, 11102, 12103, 12102, 13103, 13102, 23203, 31203, 21103, 20103];
const MAIN_STATS_BY_SLOT: Record<number, number[]> = {
    1: [11103],
    2: [12103],
    3: [13103],
    4: [12102, 13102, 11102, 20103, 21103, 31203],
    5: [12102, 13102, 11102, 23103, 31503, 31603, 31703, 31803, 31903, 32303],
    6: [12102, 13102, 11102, 12202, 31402, 30502],
};

const SKILLS = [
    { id: 0, name: "Basic Attack", max: 12 },
    { id: 2, name: "Dodge", max: 12 },
    { id: 6, name: "Assist", max: 12 },
    { id: 1, name: "Special Attack", max: 12 },
    { id: 3, name: "Chain Attack", max: 12 },
    { id: 5, name: "Core Skill", max: 7 },
    { id: 4, name: "Unique Skill", max: 12 },
];

const getStatName = (id: number) => STATS.find((stat) => stat.id === id)?.name ?? "Select stat";
const getMaxDiskRolls = (rank: number) => rank + 1;
const isDiskConfig = (value: unknown): value is DiskConfig => {
    if (!value || typeof value !== "object") return false;
    const config = value as DiskConfig;
    return (config.setId === undefined || Number.isInteger(config.setId)) &&
        Number.isInteger(config.rank) && Number.isInteger(config.slot) &&
        Number.isInteger(config.mainStat) && Array.isArray(config.subStatIds) &&
        config.subStatIds.length === 4 && config.subStatIds.every(Number.isInteger) &&
        Array.isArray(config.subStatRolls) && config.subStatRolls.length === 4 &&
        config.subStatRolls.every(Number.isInteger) && typeof config.allowOverLimitRolls === "boolean";
};
const isSavedDiskSet = (value: unknown): value is SavedDiskSet => {
    if (!value || typeof value !== "object") return false;
    const savedSet = value as SavedDiskSet;
    if (typeof savedSet.id !== "string" || typeof savedSet.name !== "string" ||
        !Number.isInteger(savedSet.setId) || !Array.isArray(savedSet.disks) ||
        savedSet.disks.length < 1 || savedSet.disks.length > 6 ||
        !savedSet.disks.every(isDiskConfig)) return false;
    return new Set(savedSet.disks.map((disk) => disk.slot)).size === savedSet.disks.length &&
        savedSet.disks.every((disk) => disk.slot >= 1 && disk.slot <= 6);
};
const getDiskConfigError = (config: DiskConfig): string | null => {
    if (config.rank < 2 || config.rank > 4 || config.slot < 1 || config.slot > 6) return "Invalid Drive Disc rank or slot.";
    if (!(MAIN_STATS_BY_SLOT[config.slot] ?? []).includes(config.mainStat)) return `Main stat is invalid for slot ${config.slot}.`;
    if (config.subStatIds.some((id) => !SUBSTAT_IDS.includes(id)) ||
        new Set([config.mainStat, ...config.subStatIds]).size !== 5) return `Slot ${config.slot} must have four different valid substats.`;
    if (config.subStatRolls.some((rolls) => rolls < 0 || rolls > 14)) return `Slot ${config.slot} roll counts must be between 0 and 14.`;
    const rollLimit = config.allowOverLimitRolls ? 56 : getMaxDiskRolls(config.rank);
    if (config.subStatRolls.reduce((sum, rolls) => sum + rolls, 0) > rollLimit) {
        return `Slot ${config.slot} exceeds its ${rollLimit}-roll limit.`;
    }
    return null;
};
const getPlayerUid = () => {
    const savedUidText = localStorage.getItem("hoyoPlayerUid");
    if (savedUidText === "1") return "67";
    const savedUid = Number(savedUidText);
    return Number.isSafeInteger(savedUid) && savedUid > 0 && savedUid <= 0xffffffff ? String(savedUid) : "67";
};

function CatalogCard({
    item,
    category,
    selected,
    onSelect,
}: {
    item: CatalogItem;
    category: Category;
    selected: boolean;
    onSelect: () => void;
}) {
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => setImageFailed(false), [item.imagePath]);

    const rarity = category === "weapons" ? Math.floor(item.id / 1000) - 10 : 0;
    const rarityLabel = rarity === 4 ? "S-RANK" : rarity === 3 ? "A-RANK" : rarity === 2 ? "B-RANK" : "";

    return (
        <button
            type="button"
            className={`hoyo-item-card ${selected ? "is-selected" : ""} ${rarityLabel ? `rarity-${rarity}` : ""}`}
            onClick={onSelect}
            aria-pressed={selected}
            title={item.name}
        >
            <span className="hoyo-item-card__art">
                {item.imagePath && !imageFailed ? (
                    <img src={item.imagePath} alt="" loading="lazy" onError={() => setImageFailed(true)} />
                ) : (
                    <span className="hoyo-item-card__fallback">
                        <span aria-hidden="true">{category === "disks" ? <Sparkles size={24} /> : item.name.slice(0, 1)}</span>
                        <small>Local image missing</small>
                    </span>
                )}
                {rarityLabel && <span className="hoyo-item-card__rarity">{rarityLabel}</span>}
            </span>
            <span className="hoyo-item-card__name">{item.name}</span>
            <span className="hoyo-item-card__id">ID {item.id}{item.imageId && ` · IMG ${item.imageId}`}</span>
        </button>
    );
}

function NumberField({
    label,
    value,
    min,
    max,
    onChange,
    optional = false,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    optional?: boolean;
}) {
    return (
        <label className="hoyo-field">
            <span>{label}{optional && <small>OPTIONAL</small>}</span>
            <input
                type="number"
                min={min}
                max={max}
                value={value || ""}
                placeholder={optional ? "Leave unchanged" : `${min} - ${max}`}
                onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
            />
        </label>
    );
}

export default function HoyoPage() {
    const [catalog, setCatalog] = useState<HoyoCatalog | null>(null);
    const [catalogError, setCatalogError] = useState("");
    const [category, setCategory] = useState<Category>("disks");
    const [search, setSearch] = useState("");
    const [playerUid, setPlayerUid] = useState(getPlayerUid);
    const [selectedDiskId, setSelectedDiskId] = useState<number | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
    const [selectedWeaponId, setSelectedWeaponId] = useState<number | null>(null);
    const [diskSlot, setDiskSlot] = useState(1);
    const [diskRank, setDiskRank] = useState(4);
    const [mainStat, setMainStat] = useState(11103);
    const [subStatIds, setSubStatIds] = useState([0, 0, 0, 0]);
    const [subStatRolls, setSubStatRolls] = useState([0, 0, 0, 0]);
    const [allowOverLimitRolls, setAllowOverLimitRolls] = useState(false);
    const [draftDiskSetId, setDraftDiskSetId] = useState<number | null>(null);
    const [draftDiskSlots, setDraftDiskSlots] = useState<DiskConfig[]>([]);
    const [draftSavedSetId, setDraftSavedSetId] = useState<string | null>(null);
    const [diskSetName, setDiskSetName] = useState("");
    const [savedDiskSets, setSavedDiskSets] = useState<SavedDiskSet[]>([]);
    const [editingSavedDisks, setEditingSavedDisks] = useState<Record<string, DiskConfig>>({});
    const [agentLevel, setAgentLevel] = useState(0);
    const [skillLevels, setSkillLevels] = useState([0, 0, 0, 0, 0, 0, 0]);
    const [mindscape, setMindscape] = useState(-1);
    const [weaponLevel, setWeaponLevel] = useState(60);
    const [refinement, setRefinement] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(SAVED_DISK_SETS_KEY);
            if (!stored) return;
            const parsed: unknown = JSON.parse(stored);
            if (!Array.isArray(parsed) || !parsed.every(isSavedDiskSet)) {
                throw new Error("Saved Drive Disc sets have an invalid format.");
            }
            setSavedDiskSets(parsed);
        } catch (error: unknown) {
            toast.error(`Could not load saved Drive Disc sets: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    const loadCatalog = async () => {
        setCatalogError("");
        try {
            const [result, error] = await HoyoService.GetCatalog();
            if (error) {
                setCatalog(null);
                setCatalogError(error);
                return;
            }
            setCatalog(result);
        } catch (error: unknown) {
            setCatalog(null);
            setCatalogError(error instanceof Error ? error.message : String(error));
        }
    };

    useEffect(() => {
        let mounted = true;
        HoyoService.GetCatalog()
            .then(([result, error]) => {
                if (!mounted) return;
                if (error) {
                    setCatalogError(error);
                    return;
                }
                setCatalog(result);
            })
            .catch((error: unknown) => {
                if (mounted) setCatalogError(error instanceof Error ? error.message : String(error));
            });
        return () => {
            mounted = false;
        };
    }, []);

    const currentItems = useMemo(() => {
        if (!catalog) return [];
        return category === "disks" ? catalog.disks : category === "characters" ? catalog.characters : catalog.weapons;
    }, [catalog, category]);

    const filteredItems = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        if (!normalized) return currentItems;
        return currentItems.filter((item) => item.name.toLowerCase().includes(normalized) || String(item.id).includes(normalized));
    }, [currentItems, search]);

    const mainStatOptions = MAIN_STATS_BY_SLOT[diskSlot] ?? [];
    const totalRolls = subStatRolls.reduce((sum, roll) => sum + roll, 0);
    const maxDiskRolls = getMaxDiskRolls(diskRank);
    const rollLimit = allowOverLimitRolls ? 56 : maxDiskRolls;
    const selectedItemId = category === "disks" ? selectedDiskId : category === "characters" ? selectedAgentId : selectedWeaponId;
    const selectedItem = currentItems.find((item) => item.id === selectedItemId);
    const activeDraftSet = savedDiskSets.find((set) => set.id === draftSavedSetId);
    const currentDraftSlots = activeDraftSet?.disks ?? draftDiskSlots;
    const draftSlotCount = currentDraftSlots.length;
    const activeDraftSlot = currentDraftSlots.find((disk) => disk.slot === diskSlot);
    const uid = Number(playerUid);
    const validUid = Number.isSafeInteger(uid) && uid > 0 && uid <= 0xffffffff;

    const submit = async (action: () => Promise<[boolean, string]>, successMessage: string) => {
        if (!validUid) {
            toast.error("Enter a valid player UID between 1 and 4,294,967,295.");
            return;
        }
        setIsSubmitting(true);
        try {
            localStorage.setItem("hoyoPlayerUid", String(uid));
            const [ok, message] = await action();
            if (!ok) {
                toast.error(message || "The Remielle control request failed.");
                return;
            }
            toast.success(successMessage);
        } catch (error: unknown) {
            toast.error(`Hoyo request failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const createDisk = (stats = subStatIds, rolls = subStatRolls) => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        const config: DiskConfig = {
            setId: selectedDiskId,
            rank: diskRank,
            slot: diskSlot,
            mainStat,
            subStatIds: stats,
            subStatRolls: rolls,
            allowOverLimitRolls,
        };
        const validationError = getDiskConfigError(config);
        if (validationError) {
            toast.error(validationError);
            return;
        }
        void submit(
            () => HoyoService.CreateDisk(uid, selectedDiskId, diskRank, diskSlot, mainStat, stats, rolls),
            "Drive Disc created.",
        );
    };

    const selectDiskSlot = (slot: number) => {
        setDiskSlot(slot);
        const savedSlot = currentDraftSlots.find((disk) => disk.slot === slot);
        if (savedSlot) {
            setSelectedDiskId(savedSlot.setId ?? activeDraftSet?.setId ?? draftDiskSetId ?? selectedDiskId);
            setDiskRank(savedSlot.rank);
            setMainStat(savedSlot.mainStat);
            setSubStatIds(savedSlot.subStatIds);
            setSubStatRolls(savedSlot.subStatRolls);
            setAllowOverLimitRolls(savedSlot.allowOverLimitRolls);
            return;
        }
        setMainStat(MAIN_STATS_BY_SLOT[slot][0]);
        setSubStatIds([0, 0, 0, 0]);
        setSubStatRolls([0, 0, 0, 0]);
    };

    const saveCurrentDiskSlot = () => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        const config: DiskConfig = {
            setId: selectedDiskId,
            rank: diskRank,
            slot: diskSlot,
            mainStat,
            subStatIds,
            subStatRolls,
            allowOverLimitRolls,
        };
        const validationError = getDiskConfigError(config);
        if (validationError) {
            toast.error(validationError);
            return;
        }
        const currentDraft = currentDraftSlots;
        const updatedDraft = [...currentDraft.filter((disk) => disk.slot !== diskSlot), config].sort((a, b) => a.slot - b.slot);
        const existingSet = activeDraftSet;
        const baseName = catalog?.disks.find((item) => item.id === selectedDiskId)?.name ?? "Drive Disc Set";
        const existingName = diskSetName.trim() || existingSet?.name;
        let name = (existingName || baseName).slice(0, 40);
        if (!existingSet && !existingName) {
            let suffix = 2;
            while (savedDiskSets.some((set) => set.name.toLowerCase() === name.toLowerCase())) {
                const numberedName = `${baseName} ${suffix}`;
                name = numberedName.slice(0, 40);
                suffix += 1;
            }
        }

        const savedSet: SavedDiskSet = {
            id: existingSet?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            name,
            setId: existingSet?.setId ?? draftDiskSetId ?? selectedDiskId,
            disks: updatedDraft,
        };
        const updatedSets = existingSet
            ? savedDiskSets.map((set) => set.id === existingSet.id ? savedSet : set)
            : [...savedDiskSets, savedSet];
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
            setDraftDiskSetId(savedSet.setId);
            setDraftDiskSlots(updatedDraft);
            setDraftSavedSetId(savedSet.id);
            setDiskSetName(savedSet.name);
            toast.success(`Saved Slot ${diskSlot} to "${savedSet.name}" (${updatedDraft.length}/6 discs).`);
        } catch (error: unknown) {
            toast.error(`Could not save Slot ${diskSlot}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const startNewDiskSet = () => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        setDraftDiskSetId(selectedDiskId);
        setDraftDiskSlots([]);
        setDraftSavedSetId(null);
        setDiskSetName("");
        setDiskSlot(1);
        setDiskRank(4);
        setMainStat(MAIN_STATS_BY_SLOT[1][0]);
        setSubStatIds([0, 0, 0, 0]);
        setSubStatRolls([0, 0, 0, 0]);
        setAllowOverLimitRolls(false);
    };

    const addSavedDiskSet = (savedSet: SavedDiskSet) => {
        if (savedSet.disks.length === 0) {
            toast.error(`"${savedSet.name}" has no discs to add yet.`);
            return;
        }
        if (!validUid) {
            toast.error("Enter a valid player UID between 1 and 4,294,967,295.");
            return;
        }
        const invalidDisk = savedSet.disks.find((disk) => getDiskConfigError(disk));
        if (invalidDisk) {
            toast.error(getDiskConfigError(invalidDisk) ?? "A saved Drive Disc is invalid.");
            return;
        }
        void submit(async () => {
            localStorage.setItem("hoyoPlayerUid", String(uid));
            let created = 0;
            for (const disk of [...savedSet.disks].sort((a, b) => a.slot - b.slot)) {
                try {
                    const [ok, message] = await HoyoService.CreateDisk(
                        uid,
                        disk.setId ?? savedSet.setId,
                        disk.rank,
                        disk.slot,
                        disk.mainStat,
                        disk.subStatIds,
                        disk.subStatRolls,
                    );
                    if (!ok) {
                        return [false, `Added ${created}/${savedSet.disks.length} discs. Slot ${disk.slot} failed: ${message || "The Remielle control request failed."}`];
                    }
                    created += 1;
                } catch (error: unknown) {
                    return [false, `Added ${created}/${savedSet.disks.length} discs. Slot ${disk.slot} failed: ${error instanceof Error ? error.message : String(error)}`];
                }
            }
            return [true, ""];
        }, `Added ${savedSet.disks.length} ${savedSet.disks.length === 1 ? "disc" : "discs"} from "${savedSet.name}".`);
    };

    const editSavedDiskSlot = (savedSet: SavedDiskSet, slot: number) => {
        const disk = savedSet.disks.find((entry) => entry.slot === slot);
        const setId = disk?.setId ?? savedSet.setId;
        setSelectedDiskId(setId);
        setDraftDiskSetId(savedSet.setId);
        setDraftDiskSlots(savedSet.disks);
        setDraftSavedSetId(savedSet.id);
        setDiskSetName(savedSet.name);
        setDiskSlot(slot);
        setDiskRank(disk?.rank ?? 4);
        setMainStat(disk?.mainStat ?? MAIN_STATS_BY_SLOT[slot][0]);
        setSubStatIds(disk ? [...disk.subStatIds] : [0, 0, 0, 0]);
        setSubStatRolls(disk ? [...disk.subStatRolls] : [0, 0, 0, 0]);
        setAllowOverLimitRolls(disk?.allowOverLimitRolls ?? false);
    };

    const deleteSavedDiskSet = (savedSet: SavedDiskSet) => {
        const updatedSets = savedDiskSets.filter((set) => set.id !== savedSet.id);
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
            if (draftSavedSetId === savedSet.id) {
                setDraftSavedSetId(null);
                setDraftDiskSlots([]);
                setDraftDiskSetId(null);
            }
            toast.success(`Deleted saved set "${savedSet.name}".`);
        } catch (error: unknown) {
            toast.error(`Could not delete saved Drive Disc set: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const duplicateSavedDiskSet = (savedSet: SavedDiskSet) => {
        const baseName = `${savedSet.name} Copy`;
        let name = baseName.slice(0, 40);
        let suffix = 2;
        while (savedDiskSets.some((set) => set.name.toLowerCase() === name.toLowerCase())) {
            const suffixText = ` Copy ${suffix}`;
            name = `${savedSet.name.slice(0, 40 - suffixText.length)}${suffixText}`;
            suffix += 1;
        }
        const duplicatedSet: SavedDiskSet = {
            ...savedSet,
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            name,
            disks: savedSet.disks.map((disk) => ({
                ...disk,
                subStatIds: [...disk.subStatIds],
                subStatRolls: [...disk.subStatRolls],
            })),
        };
        const updatedSets = [...savedDiskSets, duplicatedSet];
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
            setSelectedDiskId(duplicatedSet.setId);
            setDraftDiskSetId(duplicatedSet.setId);
            setDraftDiskSlots(duplicatedSet.disks);
            setDraftSavedSetId(duplicatedSet.id);
            setDiskSetName(duplicatedSet.name);
            const nextSlot = [1, 2, 3, 4, 5, 6].find((slot) => !duplicatedSet.disks.some((disk) => disk.slot === slot)) ?? 1;
            const diskToEdit = duplicatedSet.disks.find((disk) => disk.slot === nextSlot);
            setDiskSlot(nextSlot);
            if (diskToEdit) {
                setDiskRank(diskToEdit.rank);
                setMainStat(diskToEdit.mainStat);
                setSubStatIds(diskToEdit.subStatIds);
                setSubStatRolls(diskToEdit.subStatRolls);
                setAllowOverLimitRolls(diskToEdit.allowOverLimitRolls);
            } else {
                setDiskRank(4);
                setMainStat(MAIN_STATS_BY_SLOT[nextSlot][0]);
                setSubStatIds([0, 0, 0, 0]);
                setSubStatRolls([0, 0, 0, 0]);
                setAllowOverLimitRolls(false);
            }
            toast.success(`Duplicated "${savedSet.name}" as "${name}".`);
        } catch (error: unknown) {
            toast.error(`Could not duplicate saved Drive Disc set: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const updateDiskSetName = (name: string) => {
        setDiskSetName(name);
        const normalizedName = name.trim().slice(0, 40);
        if (!normalizedName || !draftSavedSetId) return;
        const updatedSets = savedDiskSets.map((set) =>
            set.id === draftSavedSetId ? { ...set, name: normalizedName } : set,
        );
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
        } catch (error: unknown) {
            toast.error(`Could not auto-save the set name: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const savedDiskEditKey = (savedSet: SavedDiskSet, disk: DiskConfig) => `${savedSet.id}:${disk.slot}`;

    const updateSavedDiskEdit = (key: string, update: (disk: DiskConfig) => DiskConfig) => {
        const currentDisk = editingSavedDisks[key];
        if (!currentDisk) return;
        const updatedDisk = update(currentDisk);
        setEditingSavedDisks((current) => ({ ...current, [key]: updatedDisk }));

        if (getDiskConfigError(updatedDisk)) return;
        const [setId, slotText] = key.split(":");
        const slot = Number(slotText);
        const updatedSets = savedDiskSets.map((set) => set.id === setId
            ? { ...set, disks: set.disks.map((disk) => disk.slot === slot ? updatedDisk : disk) }
            : set);
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
        } catch (error: unknown) {
            toast.error(`Could not auto-save Drive Disc changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const createDefaultDisk = () => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        const defaultSubstats = [11102, 12103, 12102, 13103];
        setDiskSlot(1);
        setDiskRank(2);
        setMainStat(11103);
        setSubStatIds(defaultSubstats);
        setSubStatRolls([0, 0, 0, 0]);
        void submit(
            () => HoyoService.CreateDisk(uid, selectedDiskId, 2, 1, 11103, defaultSubstats, [0, 0, 0, 0]),
            "Default B-Rank Drive Disc created.",
        );
    };

    const applyDefaultAgent = () => {
        if (!selectedAgentId) {
            toast.error("Select an agent first.");
            return;
        }
        const defaultSkills = SKILLS.reduce((levels, skill) => {
            levels[skill.id] = 1;
            return levels;
        }, [0, 0, 0, 0, 0, 0, 0]);
        setAgentLevel(1);
        setSkillLevels(defaultSkills);
        setMindscape(0);
        void submit(
            () => HoyoService.ModifyCharacter(uid, selectedAgentId, 1, defaultSkills, 0),
            "Agent set to default values.",
        );
    };

    const createDefaultWeapon = () => {
        if (!selectedWeaponId) {
            toast.error("Select a W-Engine first.");
            return;
        }
        setWeaponLevel(1);
        setRefinement(1);
        void submit(
            () => HoyoService.CreateWeapon(uid, selectedWeaponId, 1, 1),
            "Default W-Engine created.",
        );
    };

    const randomizeDiskStats = () => {
        if (mainStatOptions.indexOf(mainStat) < 0) {
            toast.error("Select a valid slot and main stat first.");
            return;
        }
        const available = SUBSTAT_IDS.filter((id) => id !== mainStat);
        for (let index = available.length - 1; index > 0; index--) {
            const swap = Math.floor(Math.random() * (index + 1));
            [available[index], available[swap]] = [available[swap], available[index]];
        }
        setSubStatIds(available.slice(0, 4));
    };

    const randomizeDiskRolls = () => {
        const randomRolls = [0, 0, 0, 0];
        const rollsToAssign = Math.floor(Math.random() * (rollLimit + 1));
        for (let index = 0; index < rollsToAssign; index++) {
            const eligible = randomRolls
                .map((rolls, index) => rolls < 14 ? index : -1)
                .filter((index) => index >= 0);
            if (eligible.length === 0) break;
            randomRolls[eligible[Math.floor(Math.random() * eligible.length)]] += 1;
        }
        setSubStatRolls(randomRolls);
    };

    const updateSubstat = (index: number, statID: number) => {
        setSubStatIds((current) => current.map((value, i) => i === index ? statID : value));
    };

    const updateSubstatRolls = (index: number, rolls: number) => {
        const otherRolls = totalRolls - subStatRolls[index];
        const fieldMax = Math.min(14, rollLimit - otherRolls);
        const boundedRolls = Number.isFinite(rolls) ? Math.max(0, Math.min(fieldMax, Math.floor(rolls))) : 0;
        setSubStatRolls((current) => current.map((value, i) => i === index ? boundedRolls : value));
    };

    const selectedTab = TABS.find((tab) => tab.id === category) ?? TABS[0];

    return (
        <main className="hoyo-page">
            <header className="hoyo-header">
                <div>
                    <div className="hoyo-eyebrow"><span /> REMIELLE CONTROL CENTER</div>
                    <h1>Hoyo Workshop</h1>
                    <p>Build Drive Discs, tune agents, and add W-Engines with visual item search.</p>
                </div>
                <label className={`hoyo-uid ${validUid ? "" : "is-invalid"}`}>
                    <span>PLAYER UID</span>
                    <input
                        type="number"
                        min="1"
                        max="4294967295"
                        value={playerUid}
                        onChange={(event) => setPlayerUid(event.target.value)}
                        aria-invalid={!validUid}
                    />
                </label>
            </header>

            <div className="hoyo-notice">
                <ShieldCheck size={17} />
                <span>Connects to the local Remielle control interface at <strong>127.0.0.1:15810</strong>. The server must be running and your UID must be online.</span>
            </div>
            <p className="hoyo-artwork-note">Artwork is loaded from local files in <code>frontend/public/hoyo/</code>; see that folder for the expected image names.</p>

            <nav className="hoyo-tabs" aria-label="Hoyo tools">
                {TABS.map((tab, index) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={category === tab.id ? "is-active" : ""}
                        onClick={() => {
                            setCategory(tab.id);
                            setSearch("");
                        }}
                    >
                        <span className="hoyo-tabs__number">0{index + 1}</span>
                        <span>{tab.label}</span>
                        <small>{tab.caption}</small>
                    </button>
                ))}
            </nav>

            {catalogError ? (
                <section className="hoyo-catalog-error" role="alert">
                    <h2>Could not load the item catalogue</h2>
                    <p>{catalogError}</p>
                    <button type="button" onClick={() => void loadCatalog()}>Try again</button>
                    <a href="https://zzz.nanoka.cc/character" target="_blank" rel="noreferrer">Nanoka <ExternalLink size={13} /></a>
                </section>
            ) : !catalog ? (
                <div className="hoyo-loading"><LoaderCircle size={20} className="hoyo-spinner" /> Loading item catalogue…</div>
            ) : (
                <>
                <section className="hoyo-workspace">
                    <div className="hoyo-catalog">
                        <div className="hoyo-catalog__toolbar">
                            <label className="hoyo-search">
                                <Search size={16} />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={`Search ${selectedTab.label.toLowerCase()}…`}
                                    aria-label={`Search ${selectedTab.label}`}
                                />
                            </label>
                            <span>{filteredItems.length} ITEMS</span>
                        </div>
                        {filteredItems.length > 0 ? (
                            <div className="hoyo-grid">
                                {filteredItems.map((item) => (
                                    <CatalogCard
                                        key={`${category}-${item.id}`}
                                        item={item}
                                        category={category}
                                        selected={selectedItemId === item.id}
                                        onSelect={() => {
                                            if (category === "disks") setSelectedDiskId(item.id);
                                            if (category === "characters") setSelectedAgentId(item.id);
                                            if (category === "weapons") setSelectedWeaponId(item.id);
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="hoyo-empty">No items match “{search}”.</div>
                        )}
                        <div className="hoyo-attribution">
                            Artwork and item data from <a href="https://zzz.nanoka.cc/character" target="_blank" rel="noreferrer">Nanoka <ExternalLink size={12} /></a>
                        </div>
                    </div>

                    <aside className="hoyo-editor">
                        <div className="hoyo-editor__heading">
                            <span>CONFIGURATION</span>
                            <h2>{selectedItem?.name ?? selectedTab.label}</h2>
                            <p>{selectedItem ? `Selected item · ${selectedItem.id}` : "Choose an item from the catalogue to begin."}</p>
                        </div>

                        {category === "disks" && (
                            <div className="hoyo-editor__body">
                                <div className="hoyo-max-row">
                                    <span>QUICK ACTION</span>
                                    <button
                                        type="button"
                                        className="hoyo-max-button"
                                        disabled={isSubmitting || !selectedDiskId}
                                        onClick={createDefaultDisk}
                                        title="Create a B-Rank Slot 1 disc with default stats"
                                    >
                                        ADD DEFAULT
                                    </button>
                                </div>
                                <section className="hoyo-disk-set-builder" aria-label="Save a six-disc set">
                                    <div className="hoyo-max-row">
                                        <span>6-DISC SET · AUTO-SAVE</span>
                                        <b>{draftSlotCount}/6 SLOTS</b>
                                    </div>
                                    <p>Start a new set anytime, even with the same Drive Disc type and stats as an existing set.</p>
                                    <button
                                        type="button"
                                        className="hoyo-button hoyo-button--muted"
                                        disabled={!selectedDiskId}
                                        onClick={startNewDiskSet}
                                    >
                                        NEW SET
                                    </button>
                                    <div className="hoyo-disk-set-builder__actions">
                                        <button
                                            type="button"
                                            className="hoyo-button hoyo-button--muted"
                                            disabled={isSubmitting || !selectedDiskId}
                                            onClick={saveCurrentDiskSlot}
                                        >
                                            SAVE SLOT {diskSlot}{activeDraftSlot ? " · SAVED" : ""}
                                        </button>
                                    </div>
                                    <label className="hoyo-field">
                                        <span>SET NAME <small>{draftSavedSetId ? "SAVED" : "OPTIONAL · AUTO-NAMED IF BLANK"}</small></span>
                                        <input
                                            type="text"
                                            maxLength={40}
                                            value={diskSetName}
                                            onChange={(event) => updateDiskSetName(event.target.value)}
                                            placeholder="e.g. Ellen Ice Build"
                                        />
                                    </label>
                                </section>
                                <label className="hoyo-field">
                                    <span>DISK SLOT</span>
                                    <select value={diskSlot} onChange={(event) => selectDiskSlot(Number(event.target.value))}>
                                        {[1, 2, 3, 4, 5, 6].map((slot) => <option key={slot} value={slot}>Slot {slot}</option>)}
                                    </select>
                                </label>
                                <label className="hoyo-field">
                                    <span>RARITY</span>
                                    <select value={diskRank} onChange={(event) => setDiskRank(Number(event.target.value))}>
                                        <option value={2}>B-Rank</option>
                                        <option value={3}>A-Rank</option>
                                        <option value={4}>S-Rank</option>
                                    </select>
                                </label>
                                <label className="hoyo-field">
                                    <span>MAIN STAT</span>
                                    <select value={mainStat} onChange={(event) => {
                                        setMainStat(Number(event.target.value));
                                        setSubStatIds([0, 0, 0, 0]);
                                        setSubStatRolls([0, 0, 0, 0]);
                                    }}>
                                        {mainStatOptions.map((id) => <option key={id} value={id}>{getStatName(id)}</option>)}
                                    </select>
                                </label>
                                <div className="hoyo-substats">
                                    <div className="hoyo-substats__heading">
                                        <span>SUBSTATS</span>
                                        <b>{totalRolls} / {rollLimit} EXTRA ROLLS</b>
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            aria-pressed={allowOverLimitRolls}
                                            disabled={isSubmitting}
                                            onClick={() => setAllowOverLimitRolls((enabled) => !enabled)}
                                        >
                                            {allowOverLimitRolls ? "OVER LIMIT ON" : "ALLOW OVER LIMIT"}
                                        </button>
                                    </div>
                                    {subStatIds.map((statID, index) => {
                                        const choices = SUBSTAT_IDS.filter((id) =>
                                            id !== mainStat && (id === statID || !subStatIds.some((other, otherIndex) => otherIndex !== index && other === id)),
                                        );
                                        const otherRolls = totalRolls - subStatRolls[index];
                                        return (
                                            <div className="hoyo-substat-row" key={`substat-${index}`}>
                                                <select value={statID} onChange={(event) => updateSubstat(index, Number(event.target.value))} aria-label={`Substat ${index + 1}`}>
                                                    <option value={0}>Choose stat {index + 1}</option>
                                                    {choices.map((id) => <option key={id} value={id}>{getStatName(id)}</option>)}
                                                </select>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={Math.max(0, Math.min(14, rollLimit - otherRolls))}
                                                    value={subStatRolls[index]}
                                                    onChange={(event) => updateSubstatRolls(index, Number(event.target.value))}
                                                    aria-label={`Additional rolls for substat ${index + 1}`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="hoyo-editor__actions hoyo-editor__actions--disks">
                                    <button type="button" className="hoyo-button hoyo-button--muted" disabled={isSubmitting} onClick={randomizeDiskStats}>Randomize stats</button>
                                    <button type="button" className="hoyo-button hoyo-button--muted" disabled={isSubmitting} onClick={randomizeDiskRolls}>Randomize rolls</button>
                                    <button type="button" className="hoyo-button hoyo-button--primary" disabled={isSubmitting || !selectedDiskId || totalRolls > rollLimit} onClick={() => createDisk()}>
                                        {isSubmitting ? "Sending…" : "Add Drive Disc"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {category === "characters" && (
                            <div className="hoyo-editor__body">
                                <div className="hoyo-max-row">
                                    <span>AGENT LEVEL & SKILLS</span>
                                    <div className="hoyo-quick-actions">
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting || !selectedAgentId}
                                            onClick={applyDefaultAgent}
                                            title="Set this agent to level 1, skill levels 1, and Mindscape 0"
                                        >
                                            APPLY DEFAULT
                                        </button>
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting}
                                            onClick={() => {
                                                setAgentLevel(60);
                                                setSkillLevels(SKILLS.reduce((levels, skill) => {
                                                    levels[skill.id] = skill.max;
                                                    return levels;
                                                }, [0, 0, 0, 0, 0, 0, 0]));
                                                setMindscape(6);
                                            }}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>
                                <NumberField label="AGENT LEVEL" min={1} max={60} value={agentLevel} optional onChange={setAgentLevel} />
                                <div className="hoyo-skills">
                                    <div className="hoyo-substats__heading"><span>SKILL LEVELS</span><b>LEAVE BLANK TO KEEP</b></div>
                                    {SKILLS.map((skill) => (
                                        <NumberField
                                            key={skill.name}
                                            label={skill.name}
                                            min={1}
                                            max={skill.max}
                                            value={skillLevels[skill.id]}
                                            optional
                                            onChange={(value) => setSkillLevels((current) => current.map((level, id) => id === skill.id ? value : level))}
                                        />
                                    ))}
                                </div>
                                <label className="hoyo-field">
                                    <span>MINDSCAPE <small>OPTIONAL</small></span>
                                    <select value={mindscape} onChange={(event) => setMindscape(Number(event.target.value))}>
                                        <option value={-1}>Leave unchanged</option>
                                        {[0, 1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>M{value}</option>)}
                                    </select>
                                </label>
                                <button
                                    type="button"
                                    className="hoyo-button hoyo-button--primary hoyo-button--full"
                                    disabled={isSubmitting || !selectedAgentId}
                                    onClick={() => void submit(
                                        () => HoyoService.ModifyCharacter(uid, selectedAgentId!, agentLevel, skillLevels, mindscape),
                                        "Agent updated.",
                                    )}
                                >
                                    {isSubmitting ? "Sending…" : "Apply agent changes"}
                                </button>
                            </div>
                        )}

                        {category === "weapons" && (
                            <div className="hoyo-editor__body">
                                <div className="hoyo-max-row">
                                    <span>W-ENGINE LEVEL & REFINEMENT</span>
                                    <div className="hoyo-quick-actions">
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting || !selectedWeaponId}
                                            onClick={createDefaultWeapon}
                                            title="Create a level 1 W1 copy of this W-Engine"
                                        >
                                            ADD DEFAULT
                                        </button>
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting}
                                            onClick={() => {
                                                setWeaponLevel(60);
                                                setRefinement(5);
                                            }}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>
                                <NumberField label="W-ENGINE LEVEL" min={1} max={60} value={weaponLevel} onChange={setWeaponLevel} />
                                <label className="hoyo-field">
                                    <span>REFINEMENT</span>
                                    <select value={refinement} onChange={(event) => setRefinement(Number(event.target.value))}>
                                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>W{value}</option>)}
                                    </select>
                                </label>
                                <div className="hoyo-rank-note">
                                    <Sparkles size={16} />
                                    Weapon rank is derived from the selected engine. Promotion is calculated from its level.
                                </div>
                                <button
                                    type="button"
                                    className="hoyo-button hoyo-button--primary hoyo-button--full"
                                    disabled={isSubmitting || !selectedWeaponId}
                                    onClick={() => void submit(
                                        () => HoyoService.CreateWeapon(uid, selectedWeaponId!, weaponLevel, refinement),
                                        "W-Engine created.",
                                    )}
                                >
                                    {isSubmitting ? "Sending…" : "Create W-Engine"}
                                </button>
                            </div>
                        )}
                    </aside>
                </section>
                {category === "disks" && (
                    <section className="hoyo-saved-disk-sets" aria-label="Saved six-disc sets">
                        <div className="hoyo-saved-disk-sets__heading">
                            <div>
                                <span>SAVED LOADOUTS</span>
                                <h2>Drive Disc Sets</h2>
                                <p>Each set shows the exact stats for all six discs.</p>
                            </div>
                            <b>{savedDiskSets.length} SETS</b>
                        </div>
                        {savedDiskSets.length === 0 ? (
                            <div className="hoyo-saved-disk-sets__empty">No saved sets yet. Name a set and save its first slot to create it here.</div>
                        ) : (
                            <div className="hoyo-saved-disk-sets__list">
                                {savedDiskSets.map((savedSet) => {
                                    const savedSetIds = [...new Set(savedSet.disks.map((disk) => disk.setId ?? savedSet.setId))];
                                    const diskSetItem = catalog.disks.find((item) => item.id === savedSetIds[0]);
                                    const setDescription = savedSetIds.length > 1
                                        ? `${savedSetIds.length} MIXED DRIVE DISC SETS`
                                        : diskSetItem?.name ?? `Drive Disc set ${savedSet.setId}`;
                                    return (
                                        <article className="hoyo-saved-disk-set" key={savedSet.id}>
                                            <header className="hoyo-saved-disk-set__header">
                                                <div className="hoyo-saved-disk-set__title">
                                                    {diskSetItem?.imagePath ? <img src={diskSetItem.imagePath} alt="" /> : <Sparkles size={20} />}
                                                    <div>
                                                        <h3>{savedSet.name}</h3>
                                                        <span>{setDescription} · {savedSet.disks.length}/6 DISCS</span>
                                                    </div>
                                                </div>
                                                <div className="hoyo-saved-disk-set__actions">
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--muted"
                                                        disabled={isSubmitting}
                                                        onClick={() => duplicateSavedDiskSet(savedSet)}
                                                        aria-label={`Duplicate saved set ${savedSet.name}`}
                                                        title="Create an editable copy of this set"
                                                    >
                                                        <Copy size={12} /> DUPLICATE
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--primary"
                                                        disabled={isSubmitting}
                                                        onClick={() => addSavedDiskSet(savedSet)}
                                                    >
                                                        {isSubmitting ? "ADDING…" : `ADD ${savedSet.disks.length} ${savedSet.disks.length === 1 ? "DISC" : "DISCS"}`}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--muted"
                                                        disabled={isSubmitting}
                                                        onClick={() => deleteSavedDiskSet(savedSet)}
                                                        aria-label={`Delete saved set ${savedSet.name}`}
                                                    >
                                                        DELETE
                                                    </button>
                                                </div>
                                            </header>
                                            <div className="hoyo-saved-disk-set__disks">
                                                {[1, 2, 3, 4, 5, 6].map((slot) => {
                                                    const disk = savedSet.disks.find((entry) => entry.slot === slot);
                                                    if (!disk) {
                                                        return (
                                                            <div className="hoyo-saved-disk-card is-empty" key={`${savedSet.id}-${slot}`}>
                                                                <div className="hoyo-saved-disk-card__heading">
                                                                    <b>SLOT {slot}</b>
                                                                    <span>EMPTY</span>
                                                                </div>
                                                                <p>Save this slot to add it to the set.</p>
                                                                <button
                                                                    type="button"
                                                                    className="hoyo-saved-disk-card__edit-button"
                                                                    onClick={() => editSavedDiskSlot(savedSet, slot)}
                                                                    aria-label={`Add a disc to slot ${slot} of ${savedSet.name}`}
                                                                >
                                                                    ADD DISC
                                                                </button>
                                                            </div>
                                                        );
                                                    }
                                                    const editKey = savedDiskEditKey(savedSet, disk);
                                                    const editedDisk = editingSavedDisks[editKey];
                                                    const diskCatalogItem = catalog.disks.find(
                                                        (item) => item.id === (editedDisk?.setId ?? disk.setId ?? savedSet.setId),
                                                    );
                                                    return (
                                                        <div className={`hoyo-saved-disk-card ${editedDisk ? "is-editing" : ""}`} key={`${savedSet.id}-${disk.slot}`}>
                                                            <div className="hoyo-saved-disk-card__heading">
                                                                <b>SLOT {disk.slot}</b>
                                                                <span>{"★".repeat(editedDisk?.rank ?? disk.rank)}</span>
                                                            </div>
                                                            <div className="hoyo-saved-disk-card__set">
                                                                {diskCatalogItem?.imagePath
                                                                    ? <img src={diskCatalogItem.imagePath} alt="" title={diskCatalogItem.name} />
                                                                    : <Sparkles size={20} aria-hidden="true" />}
                                                                <span title={diskCatalogItem?.name ?? `Drive Disc ${disk.setId ?? savedSet.setId}`}>
                                                                    {diskCatalogItem?.name ?? `Drive Disc ${disk.setId ?? savedSet.setId}`}
                                                                </span>
                                                            </div>
                                                            {editedDisk ? (
                                                                <div className="hoyo-saved-disk-card__editor">
                                                                    <label>
                                                                        <span>RANK</span>
                                                                        <select
                                                                            value={editedDisk.rank}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, rank: Number(event.target.value) }))}
                                                                        >
                                                                            <option value={2}>B-Rank</option>
                                                                            <option value={3}>A-Rank</option>
                                                                            <option value={4}>S-Rank</option>
                                                                        </select>
                                                                    </label>
                                                                    <label>
                                                                        <span>DRIVE DISC SET</span>
                                                                        <select
                                                                            value={editedDisk.setId ?? savedSet.setId}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, setId: Number(event.target.value) }))}
                                                                        >
                                                                            {catalog.disks.map((item) => (
                                                                                <option key={item.id} value={item.id}>{item.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                    <label>
                                                                        <span>MAIN STAT</span>
                                                                        <select
                                                                            value={editedDisk.mainStat}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, mainStat: Number(event.target.value) }))}
                                                                        >
                                                                            {(MAIN_STATS_BY_SLOT[disk.slot] ?? []).map((statId) => (
                                                                                <option key={statId} value={statId}>{getStatName(statId)}</option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                    {editedDisk.subStatIds.map((statId, index) => {
                                                                        const options = SUBSTAT_IDS.filter((candidate) =>
                                                                            candidate === statId || (
                                                                                candidate !== editedDisk.mainStat &&
                                                                                !editedDisk.subStatIds.some((other, otherIndex) => otherIndex !== index && other === candidate)
                                                                            ),
                                                                        );
                                                                        const maxRolls = Math.max(0, Math.min(
                                                                            14,
                                                                            (editedDisk.allowOverLimitRolls ? 56 : getMaxDiskRolls(editedDisk.rank)) -
                                                                                editedDisk.subStatRolls.reduce((sum, rolls, rollIndex) => sum + (rollIndex === index ? 0 : rolls), 0),
                                                                        ));
                                                                        return (
                                                                            <div className="hoyo-saved-disk-card__substat-edit" key={`${editKey}-${index}`}>
                                                                                <select
                                                                                    value={statId}
                                                                                    aria-label={`Slot ${disk.slot} substat ${index + 1}`}
                                                                                    onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({
                                                                                        ...current,
                                                                                        subStatIds: current.subStatIds.map((value, subIndex) => subIndex === index ? Number(event.target.value) : value),
                                                                                    }))}
                                                                                >
                                                                                    <option value={0}>Choose stat</option>
                                                                                    {options.map((option) => <option key={option} value={option}>{getStatName(option)}</option>)}
                                                                                </select>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max={maxRolls}
                                                                                    value={editedDisk.subStatRolls[index]}
                                                                                    aria-label={`Slot ${disk.slot} substat ${index + 1} rolls`}
                                                                                    onChange={(event) => {
                                                                                        const value = Number(event.target.value);
                                                                                        updateSavedDiskEdit(editKey, (current) => ({
                                                                                            ...current,
                                                                                            subStatRolls: current.subStatRolls.map((rolls, rollIndex) => rollIndex === index
                                                                                                ? Number.isFinite(value) ? Math.max(0, Math.min(maxRolls, Math.floor(value))) : 0
                                                                                                : rolls),
                                                                                        }));
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    <label className="hoyo-saved-disk-card__overlimit">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={editedDisk.allowOverLimitRolls}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, allowOverLimitRolls: event.target.checked }))}
                                                                        />
                                                                        Allow over limit
                                                                    </label>
                                                                    <div className="hoyo-saved-disk-card__edit-status" role="status">
                                                                        <span className={getDiskConfigError(editedDisk) ? "is-invalid" : ""}>
                                                                            {getDiskConfigError(editedDisk) ?? "Changes auto-saved"}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            disabled={Boolean(getDiskConfigError(editedDisk))}
                                                                            onClick={() => setEditingSavedDisks((current) => Object.fromEntries(
                                                                                Object.entries(current).filter(([key]) => key !== editKey),
                                                                            ))}
                                                                        >
                                                                            DONE
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <strong>{getStatName(disk.mainStat)}</strong>
                                                                    <ul>
                                                                        {disk.subStatIds.map((statId, index) => (
                                                                            <li key={`${disk.slot}-${statId}`}>
                                                                                <span>{getStatName(statId)}</span>
                                                                                <b>+{disk.subStatRolls[index]}</b>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                    <button
                                                                        type="button"
                                                                        className="hoyo-saved-disk-card__edit-button"
                                                                        onClick={() => setEditingSavedDisks((current) => ({ ...current, [editKey]: { ...disk, subStatIds: [...disk.subStatIds], subStatRolls: [...disk.subStatRolls] } }))}
                                                                    >
                                                                        EDIT DISC
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
                </>
            )}
        </main>
    );
}
