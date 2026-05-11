"""Friendly two-word placeholder names for untitled positions.

Pure module: no I/O, no DB, no framework imports. Returns a hyphenated
adjective-noun string like 'swift-otter' or 'brave-cottage'.

Used by the positions API when a position is created or edited with no
title. Collisions are not checked — these are placeholder labels, not
identifiers (FEN + position_type is the real identity).
"""

import random

_ADJECTIVES = [
    "swift", "brave", "calm", "bright", "quiet", "bold", "gentle", "fierce",
    "kind", "wise", "merry", "lucky", "noble", "humble", "eager", "happy",
    "clever", "graceful", "patient", "loyal", "curious", "honest", "jolly",
    "mighty", "nimble", "polite", "quick", "rare", "smooth", "tender",
    "vivid", "warm", "young", "ancient", "amber", "azure", "crimson",
    "emerald", "golden", "silver", "scarlet", "violet", "indigo", "ivory",
    "jade", "ruby", "alpine", "arctic", "atlantic", "boreal", "coastal",
    "desert", "forest", "highland", "island", "lunar", "meadow", "mountain",
    "ocean", "pacific", "prairie", "river", "solar", "stellar", "sunset",
    "tropical", "tundra", "valley", "wandering", "winter", "summer",
    "autumn", "spring", "morning", "evening", "midnight", "twilight",
    "bouncing", "dancing", "drifting", "floating", "glowing", "humming",
    "jumping", "leaping", "running", "shining", "singing", "soaring",
    "sparkling", "spinning", "wandering", "whirling", "blue", "green",
    "orange", "purple", "red", "yellow", "agile", "alert", "candid",
    "cosmic", "daring", "dapper", "dashing", "delicate", "dreamy",
    "earnest", "easy", "elegant", "fancy", "festive", "fluffy", "fresh",
    "friendly", "fuzzy", "gallant", "giddy", "glad", "gleaming", "gracious",
    "grand", "groovy", "hardy", "harmonious", "helpful", "hopeful", "icy",
    "jovial", "joyful", "lively", "lucid", "luminous", "mellow", "modest",
    "mystic", "novel", "perky", "pleasant", "plucky", "proud", "radiant",
    "regal", "savvy", "serene", "sincere", "snappy", "spirited", "splendid",
    "steady", "stout", "sturdy", "subtle", "sunny", "swift", "tactful",
    "tame", "tidy", "tireless", "tranquil", "trusty", "valiant", "vibrant",
    "vigilant", "vivid", "watchful", "whimsical", "willing", "witty",
    "zealous", "zesty",
]

_NOUNS = [
    "otter", "fox", "wolf", "bear", "lynx", "owl", "hawk", "falcon",
    "eagle", "raven", "robin", "sparrow", "swan", "heron", "crane",
    "puffin", "dolphin", "whale", "seal", "salmon", "trout", "badger",
    "beaver", "rabbit", "hare", "deer", "elk", "moose", "panda", "koala",
    "tiger", "leopard", "cheetah", "jaguar", "panther", "puma", "cougar",
    "horse", "pony", "stallion", "zebra", "antelope", "gazelle", "ibex",
    "ram", "buffalo", "bison", "yak", "camel", "lemur", "monkey", "gibbon",
    "cottage", "cabin", "tower", "castle", "lighthouse", "harbor", "bridge",
    "garden", "orchard", "meadow", "forest", "grove", "thicket", "glade",
    "valley", "canyon", "ridge", "summit", "peak", "plateau", "highland",
    "lowland", "marsh", "lagoon", "bay", "cove", "fjord", "delta",
    "island", "isle", "cape", "shore", "cliff", "beach", "dune", "oasis",
    "spring", "creek", "river", "stream", "brook", "pond", "lake", "sea",
    "ocean", "waterfall", "cascade", "rapids", "fountain", "geyser",
    "comet", "nebula", "galaxy", "planet", "star", "moon", "sun", "aurora",
    "horizon", "dawn", "dusk", "twilight", "sunrise", "sunset", "rainbow",
    "cloud", "mist", "fog", "breeze", "gale", "storm", "tempest", "drizzle",
    "rain", "snow", "frost", "ember", "spark", "flame", "candle", "lantern",
    "beacon", "compass", "lighthouse", "anchor", "sail", "rudder", "mast",
    "harp", "lyre", "flute", "drum", "fiddle", "piano", "violin", "horn",
    "willow", "oak", "pine", "cedar", "maple", "birch", "elm", "fern",
    "moss", "lichen", "ivy", "vine", "rose", "lily", "iris", "daisy",
    "tulip", "violet", "orchid", "poppy", "thistle", "clover", "heather",
    "lavender", "jasmine", "magnolia", "wisteria", "primrose", "honeysuckle",
]


def generate_placeholder_name() -> str:
    """Return a hyphenated adjective-noun pair.

    Example: 'swift-otter', 'brave-cottage', 'amber-sparrow'.
    """
    return f"{random.choice(_ADJECTIVES)}-{random.choice(_NOUNS)}"