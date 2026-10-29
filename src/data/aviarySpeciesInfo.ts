/**
 * Reference photo and short description per species, for the species pages.
 *
 * Photos are hot-linked from Wikimedia Commons under their own free licences
 * (author and licence kept for attribution). Summaries are the first sentences
 * of the English Wikipedia article (CC BY-SA 4.0). Fetched on 2026-10-28.
 * They describe the species in general, not SeaWorld's birds.
 */

export interface SpeciesPhoto {
  src: string;
  /** Commons file page (source and full licence). */
  page: string;
  author: string;
  license: string;
  licenseUrl: string | null;
}

export interface SpeciesInfo {
  article: string;
  summary: string;
  photo: SpeciesPhoto;
}

/** Keyed by species code. */
export const SPECIES_INFO: Record<string, SpeciesInfo> = {
  LOR: {
    article: "https://en.wikipedia.org/wiki/Yellow-naped_amazon",
    summary: "The yellow-naped amazon or yellow-naped parrot is a widespread amazon parrot sometimes considered to be a subspecies of the yellow-crowned amazon. It inhabits the Pacific coast of southern Mexico and Central America.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Yellow-naped_parrot_%28Amazona_auropalliata%29_Los_Tarrales.jpg/960px-Yellow-naped_parrot_%28Amazona_auropalliata%29_Los_Tarrales.jpg", page: "https://commons.wikimedia.org/wiki/File:Yellow-naped_parrot_(Amazona_auropalliata)_Los_Tarrales.jpg", author: "Charles J. Sharp", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  TUC: {
    article: "https://en.wikipedia.org/wiki/Keel-billed_toucan",
    summary: "The keel-billed toucan, also known as rainbow-billed toucan or sulphur-breasted toucan, is a species of toucan native to southern Mexico, Central America and the far northwest of South America, and is found in tropical forests. It is the national bird of Belize.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Keel-billed_toucan_%28Ramphastos_sulfuratus_sulfuratus%29_on_foxtail_palm_%28Wodyetia_bifurcata%29_Cayo.jpg/960px-Keel-billed_toucan_%28Ramphastos_sulfuratus_sulfuratus%29_on_foxtail_palm_%28Wodyetia_bifurcata%29_Cayo.jpg", page: "https://commons.wikimedia.org/wiki/File:Keel-billed_toucan_(Ramphastos_sulfuratus_sulfuratus)_on_foxtail_palm_(Wodyetia_bifurcata)_Cayo.jpg", author: "Charles J. Sharp", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  ESP: {
    article: "https://en.wikipedia.org/wiki/Roseate_spoonbill",
    summary: "The roseate spoonbill is a social wading bird of the ibis and spoonbill family, Threskiornithidae. It is a resident breeder in both South and North America.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Roseate_Spoonbill_-_Myakka_River_State_Park.jpg/960px-Roseate_Spoonbill_-_Myakka_River_State_Park.jpg", page: "https://commons.wikimedia.org/wiki/File:Roseate_Spoonbill_-_Myakka_River_State_Park.jpg", author: "User:Mwanner", license: "CC BY-SA 3.0", licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/" },
  },
  TCE: {
    article: "https://en.wikipedia.org/wiki/Northern_emerald_toucanet",
    summary: "The northern emerald toucanet also called the Wagler’s toucanet, is a species of bird in the toucan family Ramphastidae. It occurs in montane regions from southern Mexico to southern Panama.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/063_Northern_Emerald-toucanet_in_Los_Quetzales_National_Park_Photo_by_Giles_Laurent.jpg/960px-063_Northern_Emerald-toucanet_in_Los_Quetzales_National_Park_Photo_by_Giles_Laurent.jpg", page: "https://commons.wikimedia.org/wiki/File:063_Northern_Emerald-toucanet_in_Los_Quetzales_National_Park_Photo_by_Giles_Laurent.jpg", author: "Giles Laurent", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  ARS: {
    article: "https://en.wikipedia.org/wiki/Chestnut-eared_aracari",
    summary: "The chestnut-eared aracari or chestnut-eared araçari is a bird in the toucan family Ramphastidae. It is found in Argentina, Bolivia, Brazil, Colombia, Ecuador, Paraguay, and Peru.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Aracari_Castanho.jpg/960px-Aracari_Castanho.jpg", page: "https://commons.wikimedia.org/wiki/File:Aracari_Castanho.jpg", author: "Laura serradourada", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  TPR: {
    article: "https://en.wikipedia.org/wiki/Red-breasted_toucan",
    summary: "The red-breasted toucan or green-billed toucan is a bird in the family Ramphastidae, the toucans, toucanets, and aracaris. It is found in Argentina, Brazil and Paraguay.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Tucano_de_bico_verde_%28Ramphastos_dicolorus%29.jpg/960px-Tucano_de_bico_verde_%28Ramphastos_dicolorus%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Tucano_de_bico_verde_(Ramphastos_dicolorus).jpg", author: "Jairmoreirafotografia", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  GJA: {
    article: "https://en.wikipedia.org/wiki/Hyacinth_macaw",
    summary: "The hyacinth macaw, or hyacinthine macaw, is a large parrot native to central and eastern South America. With a length of about one meter it is longer than any other species of parrot.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/008_Hyacinth_macaw_couple_kissing_under_Pink_Ip%C3%AA_tree_in_Encontro_das_%C3%81guas_State_Park_Photo_by_Giles_Laurent.jpg/960px-008_Hyacinth_macaw_couple_kissing_under_Pink_Ip%C3%AA_tree_in_Encontro_das_%C3%81guas_State_Park_Photo_by_Giles_Laurent.jpg", page: "https://commons.wikimedia.org/wiki/File:008_Hyacinth_macaw_couple_kissing_under_Pink_Ip%C3%AA_tree_in_Encontro_das_%C3%81guas_State_Park_Photo_by_Giles_Laurent.jpg", author: "Giles Laurent", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  GBU: {
    article: "https://en.wikipedia.org/wiki/Great_green_macaw",
    summary: "The great green macaw, also known as Buffon's macaw or the great military macaw, is a critically endangered Central and South America parrot found in Nicaragua, Honduras, Costa Rica, Panama, Colombia and Ecuador. Two allopatric subspecies are recognized; the nominate subspecies, Ara ambiguus ssp.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Ara_ambigua.JPG/960px-Ara_ambigua.JPG", page: "https://commons.wikimedia.org/wiki/File:Ara_ambigua.JPG", author: "Alois Staudacher", license: "CC BY-SA 3.0", licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/" },
  },
  GAV: {
    article: "https://en.wikipedia.org/wiki/Red-and-green_macaw",
    summary: "The red-and-green macaw, also known as the green-winged macaw, is a large, mostly-red macaw of the genus Ara. It is popular in aviculture, and is the second most commonly kept macaw species after the blue-and-yellow macaw.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Ara_chloropterus_-Apenheul_Primate_Park_-Netherlands-8a.jpg/960px-Ara_chloropterus_-Apenheul_Primate_Park_-Netherlands-8a.jpg", page: "https://commons.wikimedia.org/wiki/File:Ara_chloropterus_-Apenheul_Primate_Park_-Netherlands-8a.jpg", author: "Arjan Haverkamp", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0" },
  },
  GBA: {
    article: "https://en.wikipedia.org/wiki/Blue-throated_macaw",
    summary: "The blue-throated macaw, also known as the Caninde macaw or Wagler's macaw, is a macaw endemic to a small area of north-central Bolivia, known as Los Llanos de Moxos. In 2014 this species was designated by law as a natural patrimony of Bolivia.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Ara_glaucogularis_-Cincinnati_Zoo-8a.jpg/960px-Ara_glaucogularis_-Cincinnati_Zoo-8a.jpg", page: "https://commons.wikimedia.org/wiki/File:Ara_glaucogularis_-Cincinnati_Zoo-8a.jpg", author: "Ted", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0" },
  },
  ECL: {
    article: "https://en.wikipedia.org/wiki/Moluccan_eclectus",
    summary: "The Moluccan eclectus is a parrot native to the Maluku Islands (Moluccas). It is unusual in the parrot order for its extreme sexual dimorphism of the colours of the plumage; the male having a mostly bright emerald green plumage and the female a mostly bright red and purple/blue plumage.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Eclectus_roratus_-North_Carolina_Zoo%2C_Asheboro%2C_North_Carolina%2C_USA_-female-8a_%281%29.jpg/960px-Eclectus_roratus_-North_Carolina_Zoo%2C_Asheboro%2C_North_Carolina%2C_USA_-female-8a_%281%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Eclectus_roratus_-North_Carolina_Zoo,_Asheboro,_North_Carolina,_USA_-female-8a_(1).jpg", author: "Selena N. B. H. from Carrboro, USA", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0" },
  },
  TVI: {
    article: "https://en.wikipedia.org/wiki/Violet_turaco",
    summary: "The violet turaco, also known as the violaceous plantain eater, is a large turaco, a group of African otidimorphae.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Violet_Turaco_RWD3.jpg/960px-Violet_Turaco_RWD3.jpg", page: "https://commons.wikimedia.org/wiki/File:Violet_Turaco_RWD3.jpg", author: "DickDaniels", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0" },
  },
  TCR: {
    article: "https://en.wikipedia.org/wiki/Red-crested_turaco",
    summary: "The red-crested turaco is a turaco, a group of African otidimorph birds. It is a frugivorous bird endemic to western Angola.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/RedcrestedTuraco.jpg/960px-RedcrestedTuraco.jpg", page: "https://commons.wikimedia.org/wiki/File:RedcrestedTuraco.jpg", author: "Daniel Demczuk", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0" },
  },
  THA: {
    article: "https://en.wikipedia.org/wiki/Hartlaub's_turaco",
    summary: "Hartlaub's turaco is a species of bird in the family Musophagidae. It is found in Kenya, Tanzania, and Uganda.",
    photo: { src: "https://upload.wikimedia.org/wikipedia/commons/a/ad/Tauraco_hartlaubi.jpg", page: "https://commons.wikimedia.org/wiki/File:Tauraco_hartlaubi.jpg", author: "Unknown author", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0" },
  },
  TCB: {
    article: "https://en.wikipedia.org/wiki/White-crested_turaco",
    summary: "The white-crested turaco is a bird in the family Musophagidae, a group of African otidimorph birds. The white-crested turaco is native to riverine forest and woodland in a belt between eastern Nigeria and western Kenya.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Tauraco_leucolophus_-Brookfield_Zoo%2C_Chicago%2C_USA-8a.jpg/960px-Tauraco_leucolophus_-Brookfield_Zoo%2C_Chicago%2C_USA-8a.jpg", page: "https://commons.wikimedia.org/wiki/File:Tauraco_leucolophus_-Brookfield_Zoo,_Chicago,_USA-8a.jpg", author: "Brian", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0" },
  },
  TCA: {
    article: "https://en.wikipedia.org/wiki/White-cheeked_turaco",
    summary: "The white-cheeked turaco is a species of bird in the family Musophagidae. It is found in Eritrea, Ethiopia, and South Sudan.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Tauraco_leucotis.jpg/960px-Tauraco_leucotis.jpg", page: "https://commons.wikimedia.org/wiki/File:Tauraco_leucotis.jpg", author: "Chrumps", license: "CC BY-SA 3.0", licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/" },
  },
  TLI: {
    article: "https://en.wikipedia.org/wiki/Livingstone's_turaco",
    summary: "Livingstone's turaco is a species of bird in the family Musophagidae, which was named for Charles Livingstone, the brother of David Livingstone.",
    photo: { src: "https://upload.wikimedia.org/wikipedia/commons/8/87/Tauraco_livingstonii_-captive_-side-8a.jpg", page: "https://commons.wikimedia.org/wiki/File:Tauraco_livingstonii_-captive_-side-8a.jpg", author: "www.opencage photographer", license: "CC BY-SA 2.5", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5" },
  },
  PNI: {
    article: "https://en.wikipedia.org/wiki/Nicobar_pigeon",
    summary: "The Nicobar pigeon or Nicobar dove is a bird found on small islands and in coastal regions from the Andaman and Nicobar Islands, India, east through the Indonesian Archipelago, to the Solomons and Palau.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Caloenas_nicobarica%2C_Ko_Miang%2C_Thailand_1.jpg/960px-Caloenas_nicobarica%2C_Ko_Miang%2C_Thailand_1.jpg", page: "https://commons.wikimedia.org/wiki/File:Caloenas_nicobarica,_Ko_Miang,_Thailand_1.jpg", author: "ziggypop74", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0" },
  },
  PIB: {
    article: "https://en.wikipedia.org/wiki/Pied_imperial_pigeon",
    summary: "The pied imperial pigeon is a relatively large, pied species of pigeon. It is found in forest, woodland, mangrove, plantations and scrub in Southeast Asia, ranging from Myanmar and Thailand, throughout Indonesia and east to the Philippines and the Bird's Head Peninsula in New Guinea.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Ducula_bicolor_-_Chinese_Garden.jpg/960px-Ducula_bicolor_-_Chinese_Garden.jpg", page: "https://commons.wikimedia.org/wiki/File:Ducula_bicolor_-_Chinese_Garden.jpg", author: "JJ Harrison", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  PCV: {
    article: "https://en.wikipedia.org/wiki/Victoria_crowned_pigeon",
    summary: "The Victoria crowned pigeon is a large, bluish-grey pigeon with elegant blue lace-like crests, maroon breast and red irises.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Goura_victoria_LC0384.jpg/960px-Goura_victoria_LC0384.jpg", page: "https://commons.wikimedia.org/wiki/File:Goura_victoria_LC0384.jpg", author: "Jörg Hempel", license: "CC BY-SA 3.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en" },
  },
  ARG: {
    article: "https://en.wikipedia.org/wiki/Great_argus",
    summary: "The great argus or greater argus is a large species of pheasant native to the jungles of Borneo, Sumatra and the Malay Peninsula in southeast Asia. It is known for its impressive plumage and courtship behavior.",
    // Replaced the article photo (bird too small to recognise in a marker).
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Great_Argus_male_RWD.jpg/960px-Great_Argus_male_RWD.jpg", page: "https://commons.wikimedia.org/wiki/File:Great_Argus_male_RWD.jpg", author: "DickDaniels", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0" },
  },
  PBC: {
    article: "https://en.wikipedia.org/wiki/Crested_partridge",
    summary: "The crested partridge, also known as the crested wood partridge, roul-roul, red-crowned wood partridge, green wood quail, and green wood partridge is a gamebird in the pheasant family Phasianidae of the order Galliformes, gallinaceous birds. It is the only member of the genus Rollulus.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Crested_Partridge_%28Rollulus_rouloul%29%2C_Tambunan%2C_Sabah%2C_Borneo_2.jpg/960px-Crested_Partridge_%28Rollulus_rouloul%29%2C_Tambunan%2C_Sabah%2C_Borneo_2.jpg", page: "https://commons.wikimedia.org/wiki/File:Crested_Partridge_(Rollulus_rouloul),_Tambunan,_Sabah,_Borneo_2.jpg", author: "tcager", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en" },
  },
  PAV: {
    article: "https://en.wikipedia.org/wiki/Indian_peafowl",
    summary: "The Indian peafowl, also known as the common peafowl, or blue peafowl, is a species of peafowl native to the Indian subcontinent. While it originated in the Indian subcontinent, it has since been introduced to many other parts of the world.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Peacock_on_tree_%2852077240794%29.jpg/960px-Peacock_on_tree_%2852077240794%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Peacock_on_tree_(52077240794).jpg", author: "Kandukuru Nagarjun from Bangalore, India", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0" },
  },
  FLA: {
    article: "https://en.wikipedia.org/wiki/Lady_Amherst's_pheasant",
    summary: "Lady Amherst's pheasant is a bird of the order Galliformes and the family Phasianidae. The genus name is from the Ancient Greek: χρυσόλόφος chrusolophos, \"with golden crest\".",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/Chrysolophus_amherstiae_18092009.jpg/960px-Chrysolophus_amherstiae_18092009.jpg", page: "https://commons.wikimedia.org/wiki/File:Chrysolophus_amherstiae_18092009.jpg", author: "Sylfred1977", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0" },
  },
  FDO: {
    article: "https://en.wikipedia.org/wiki/Golden_pheasant",
    summary: "The golden pheasant, also known as the Chinese pheasant, and rainbow pheasant, is a gamebird of the order Galliformes and the family Phasianidae (pheasants). The genus name is from Ancient Greek khrusolophos, \"with golden crest\", and pictus is Latin for \"painted\" from pingere, \"to paint\".",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Fasanhona-1.jpg/960px-Fasanhona-1.jpg", page: "https://commons.wikimedia.org/wiki/File:Fasanhona-1.jpg", author: "David Castor (user:dcastor)", license: "Public domain", licenseUrl: null },
  },
  TGO: {
    article: "https://en.wikipedia.org/wiki/Western_plantain-eater",
    summary: "The western plantain-eater, also known as the grey plantain-eater or western grey plantain-eater, is a large member of the turaco family, a group of large arboreal passerine-like birds restricted to Africa.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Western_grey_plantain-eater_%28Crinifer_piscator%29.jpg/960px-Western_grey_plantain-eater_%28Crinifer_piscator%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Western_grey_plantain-eater_(Crinifer_piscator).jpg", author: "Charles J. Sharp", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  KOO: {
    article: "https://en.wikipedia.org/wiki/Laughing_kookaburra",
    summary: "The laughing kookaburra is a bird in the kingfisher subfamily Halcyoninae. It is a large kingfisher with a whitish head and a brown eye-stripe.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Laughing_Kookaburra_1.jpg/960px-Laughing_Kookaburra_1.jpg", page: "https://commons.wikimedia.org/wiki/File:Laughing_Kookaburra_1.jpg", author: "Paulweberphoto", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0" },
  },
  BCB: {
    article: "https://en.wikipedia.org/wiki/Bearded_barbet",
    summary: "The bearded barbet is an African barbet. Barbets are birds with a worldwide tropical distribution, although New World and Old World barbets are placed in different families.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Lybius_dubius_at_the_Denver_Zoo-2012_03_12_0962.jpg/960px-Lybius_dubius_at_the_Denver_Zoo-2012_03_12_0962.jpg", page: "https://commons.wikimedia.org/wiki/File:Lybius_dubius_at_the_Denver_Zoo-2012_03_12_0962.jpg", author: "Postdlf", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0" },
  },
  CHA: {
    article: "https://en.wikipedia.org/wiki/White-crested_laughingthrush",
    summary: "The white-crested laughingthrush is a member of the family Leiothrichidae. It is a highly social and vocal bird found in forest and scrub from the Himalayan foothills to Southeast Asia.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Garrulax_leucolophus_-_Kent_Ridge_Park.jpg/960px-Garrulax_leucolophus_-_Kent_Ridge_Park.jpg", page: "https://commons.wikimedia.org/wiki/File:Garrulax_leucolophus_-_Kent_Ridge_Park.jpg", author: "JJ Harrison", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  CIG: {
    article: "https://en.wikipedia.org/wiki/Painted_stork",
    summary: "The painted stork is a large wader in the stork family. It is found in the wetlands of the plains of tropical Asia south of the Himalayas in the Indian subcontinent and extending into Southeast Asia.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/P-Stork-Sandeep.jpg/960px-P-Stork-Sandeep.jpg", page: "https://commons.wikimedia.org/wiki/File:P-Stork-Sandeep.jpg", author: "Swardeepak", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  IBE: {
    article: "https://en.wikipedia.org/wiki/Scarlet_ibis",
    summary: "The scarlet ibis, sometimes called red ibis, is a species of ibis in the bird family Threskiornithidae. It inhabits tropical South America and part of the Caribbean.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Oceanografic_Scarlet_Ibis_02.jpg/960px-Oceanografic_Scarlet_Ibis_02.jpg", page: "https://commons.wikimedia.org/wiki/File:Oceanografic_Scarlet_Ibis_02.jpg", author: "Rafa Esteve", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  IBB: {
    article: "https://en.wikipedia.org/wiki/Glossy_ibis",
    summary: "The glossy ibis is a water bird in the order Pelecaniformes and the ibis and spoonbill family Threskiornithidae. The scientific name derives from Ancient Greek plegados and Latin, falcis, both meaning \"sickle\" and referring to the distinctive shape of the bill.",
    photo: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Glossy_ibis.png/960px-Glossy_ibis.png", page: "https://commons.wikimedia.org/wiki/File:Glossy_ibis.png", author: "Chuck Homler, Focus On Wildlife", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
};
