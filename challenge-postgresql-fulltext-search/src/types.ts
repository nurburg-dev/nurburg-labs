export interface TicketRow {
  id: number;
  title: string;
  tags: string[];
  status: string;
  created_at: Date;
}

export interface SearchMeta {
  total: number;
  page: number;
  limit: number;
}

export interface SearchResponse {
  data: TicketRow[];
  meta: SearchMeta;
}

export interface ErrorResponse {
  error: string;
}
