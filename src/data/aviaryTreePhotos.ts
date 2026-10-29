import type { TreeForm } from "@/domain/aviaryTracking";

/**
 * Generic photos of real trees, one per tree form. The aviary has no surveyed tree
 * inventory, so a tree is never shown with a plant species: the photo shows what
 * that kind of tree looks like, not the tree itself. Wikimedia Commons, with credit.
 */
export const TREE_PHOTO: Record<TreeForm, { src: string; label: string; page: string; author: string; license: string }> = {
  emergent: {
    src: "/aviary/trees/emergent.jpg",
    label: "Emergent rainforest tree",
    page: "https://commons.wikimedia.org/wiki/File:Taman_Negara,_Malaysia,_Tall_trees_in_canopy.jpg",
    author: "Vyacheslav Argenberg",
    license: "CC BY 4.0",
  },
  broadleaf: {
    src: "/aviary/trees/broadleaf.jpg",
    label: "Broadleaf canopy tree",
    page: "https://commons.wikimedia.org/wiki/File:Towering_Trees_and_Canopy_Light.jpg",
    author: "Dini syawalya",
    license: "CC BY-SA 4.0",
  },
  palm: {
    src: "/aviary/trees/palm.jpg",
    label: "Tropical palm",
    page: "https://commons.wikimedia.org/wiki/File:Hawaii_Tropical_Botanical_Garden_-_panoramio_(1).jpg",
    author: "Eric Marshall",
    license: "CC BY 3.0",
  },
};
