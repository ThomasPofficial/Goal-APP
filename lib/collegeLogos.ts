const COLLEGE_DOMAINS: Record<string, string> = {
  "MIT":                                    "mit.edu",
  "Massachusetts Institute of Technology":  "mit.edu",
  "Harvard University":                     "harvard.edu",
  "Harvard":                                "harvard.edu",
  "Stanford University":                    "stanford.edu",
  "Stanford":                               "stanford.edu",
  "Yale University":                        "yale.edu",
  "Princeton University":                   "princeton.edu",
  "Columbia University":                    "columbia.edu",
  "University of Pennsylvania":             "upenn.edu",
  "Cornell University":                     "cornell.edu",
  "Dartmouth College":                      "dartmouth.edu",
  "Brown University":                       "brown.edu",
  "Duke University":                        "duke.edu",
  "Northwestern University":                "northwestern.edu",
  "Johns Hopkins University":               "jhu.edu",
  "Vanderbilt University":                  "vanderbilt.edu",
  "Rice University":                        "rice.edu",
  "Notre Dame":                             "nd.edu",
  "University of Chicago":                  "uchicago.edu",
  "Georgetown University":                  "georgetown.edu",
  "Emory University":                       "emory.edu",
  "UC Berkeley":                            "berkeley.edu",
  "UCLA":                                   "ucla.edu",
  "Michigan":                               "umich.edu",
  "University of Michigan":                 "umich.edu",
  "Howard University":                      "howard.edu",
  "Morehouse College":                      "morehouse.edu",
  "Spelman College":                        "spelman.edu",
  "NYU":                                    "nyu.edu",
  "New York University":                    "nyu.edu",
  "Boston University":                      "bu.edu",
  "Tufts University":                       "tufts.edu",
  "George Washington University":           "gwu.edu",
  "American University":                    "american.edu",
};

export function getCollegeDomain(name: string): string | null {
  return COLLEGE_DOMAINS[name] ?? null;
}

export async function fetchLogoBase64(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://logo.clearbit.com/${domain}?size=48`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}
