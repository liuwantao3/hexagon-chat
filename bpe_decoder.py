import json
from typing import List, Dict

class BPEDecoder:
    """BPE Decoder - converts token IDs back to text"""
    
    def __init__(self, vocab: Dict[str, int], merges: List[str]):
        self.vocab = vocab        # token -> id mapping
        self.id_to_token = {v: k for k, v in vocab.items()}  # id -> token
        self.merges = merges
        
        # Build decode vocabulary from merges + raw bytes
        self._build_decode_table()
    
    def _build_decode_table(self):
        """Build complete token lookup table"""
        self.decode_table = {}
        
        # Add all merges (combined tokens)
        for i, piece in enumerate(self.merges):
            self.decode_table[i] = piece
        
        # Add raw byte tokens (256 for basic ASCII)
        for i in range(256):
            self.decode_table[i + len(self.merges)] = chr(i)
        
        # Add special tokens
        special_tokens = ['<pad>', '<unk>', '<bos>', '<eos>', '<mask>']
        offset = 256 + len(self.merges)
        for j, token in enumerate(special_tokens):
            self.decode_table[offset + j] = token
    
    def decode(self, token_ids: List[int]) -> str:
        """Convert token IDs back to text string"""
        tokens = []
        
        for idx in token_ids:
            token = self.id_to_token.get(idx, self.decode_table.get(idx, '<unk>'))
            tokens.append(token)
        
        # Join tokens (BPE uses special separator for multi-token merges)
        text = ''.join(tokens)
        
        # Remove escape sequences used for special characters
        text = text.replace('Ġ', ' ')   # space (GPT style)
        text = text.replace('Ċ', '\n')   # newline
        text = text.replace('ĉ', 'Ĉ')   # encoding artifact
        text = text.replace('Ã', '')     # utf-8 continuation
        
        return text
    
    def decode_batch(self, batch_ids: List[List[int]]) -> List[str]:
        """Decode batch of token sequences"""
        return [self.decode(ids) for ids in batch_ids]


class SimpleBPEDecoder:
    """Simple decoder using pre-saved vocabulary file"""
    
    def __init__(self, model_dir: str):
        # Load vocab.json
        with open(f"{model_dir}/vocab.json", 'r', encoding='utf-8') as f:
            self.vocab = json.load(f)
        
        # Load merges.txt
        with open(f"{model_dir}/merges.txt", 'r', encoding='utf-8') as f:
            self.merges = [line.strip() for line in f][1:]  # Skip header
        
        # Reverse vocab for decoding
        self.id_to_token = {v: k for k, v in self.vocab.items()}
    
    def decode(self, token_ids: List[int]) -> str:
        """Decode token IDs to string"""
        # Token IDs might be offset - adjust based on model's actual encoding
        tokens = []
        
        for tid in token_ids:
            if tid in self.id_to_token:
                tokens.append(self.id_to_token[tid])
            else:
                tokens.append('<unk>')
        
        # Post-process (adjust for your model's special encoding)
        text = ''.join(tokens)
        
        # GPT-2 style: reverse whitespace encoding
        if hasattr(self, 'pat'):
            import re
            text = re.sub(r'Ġ', ' ', text)
            text = re.sub(r'Ċ', '\n', text)
        
        return text


# Example usage
if __name__ == "__main__":
    # Demo with simple vocab
    vocab = {
        'h': 0, 'e': 1, 'l': 2, 'o': 3, 'w': 4, 'r': 5, 'd': 6,
        'he': 7, 'll': 8, 'wo': 9, 'rl': 10, 'ld': 11,
    }
    merges = ['he', 'll', 'wo', 'rl', 'ld']
    
    decoder = BPEDecoder(vocab, merges)
    
    # Decode sequence of token IDs
    token_ids = [7, 8, 3]  # 'he' + 'll' + 'o' = "hello"
    result = decoder.decode(token_ids)
    print(f"Decoded: {result}")
    
    # More complex example
    text = "hello world"
    print(f"Original: {text}")
