/** Apply-metadata shapes aligned with @mcp-definer/schemas Manifest auth.apply. */

export interface AuthApplyApiKey {
  in: 'header' | 'query';
  name: string;
}

export interface AuthApplyBearer {
  headerName?: string;
  prefix?: string;
}

export interface AuthApplyOAuth2Cc {
  tokenUrl: string;
  scopes?: string[];
}

export interface AuthApplyOAuth2Ac {
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
}

export interface AuthApplyBasic {
  [key: string]: never;
}

export interface AuthApplyCustom {
  headers: Record<string, string>;
}
