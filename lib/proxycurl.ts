export type ProxycurlProfile = {
  first_name?: string;
  last_name?: string;
  headline?: string;
  industry?: string;
  experiences?: Array<{
    company?: string;
    title?: string;
    ends_at?: null | object;
  }>;
  education?: Array<{
    school?: string;
    degree_name?: string;
    field_of_study?: string;
  }>;
};

export async function fetchLinkedinProfile(
  linkedinUrl: string
): Promise<ProxycurlProfile | null> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?linkedin_profile_url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) return null;
    return (await res.json()) as ProxycurlProfile;
  } catch {
    return null;
  }
}
