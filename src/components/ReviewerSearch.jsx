import { Search } from "lucide-react";

export default function ReviewerSearch({ value, onChange }) {
  return (
    <label className="search-field">
      <Search size={18} aria-hidden="true" />
      <span className="sr-only">Search reviewers</span>
      <input
        type="search"
        placeholder="Search reviewers..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
