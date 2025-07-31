export interface OutingProperty {
  relation?: { id: string }[];
}

export interface Outing {
  id: string;
  properties: {
    Week?: {
      select?: {
        name?: string;
      };
    };
    [seat: string]: OutingProperty | any;
  };
}

export interface Member {
  id: string;
  name: string;
  role?: string;
  availability?: string;
}