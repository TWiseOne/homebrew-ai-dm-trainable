#!/usr/bin/env python3
"""QLoRA SFT launcher for Training V1. Install training/requirements.txt first."""
import argparse, yaml
from datasets import load_dataset
from transformers import AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer
import torch

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--config', default='training/configs/sft-qwen3-8b-4090.yaml'); a=ap.parse_args(); c=yaml.safe_load(open(a.config))
    tok=AutoTokenizer.from_pretrained(c['model_name_or_path'], trust_remote_code=True)
    ds=load_dataset('json', data_files={'train':c['train_file'],'validation':c['validation_file']})
    q=BitsAndBytesConfig(load_in_4bit=c['load_in_4bit'], bnb_4bit_quant_type='nf4', bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
    lora=LoraConfig(r=c['lora_r'],lora_alpha=c['lora_alpha'],lora_dropout=c['lora_dropout'],bias='none',task_type='CAUSAL_LM',target_modules='all-linear')
    cfg=SFTConfig(output_dir=c['output_dir'],num_train_epochs=c['num_train_epochs'],learning_rate=c['learning_rate'],per_device_train_batch_size=c['per_device_train_batch_size'],gradient_accumulation_steps=c['gradient_accumulation_steps'],warmup_ratio=c['warmup_ratio'],logging_steps=c['logging_steps'],save_strategy=c['save_strategy'],eval_strategy=c['eval_strategy'],bf16=c['bf16'],gradient_checkpointing=c['gradient_checkpointing'],max_length=c['max_seq_length'],packing=c['packing'],seed=c['seed'],report_to='none')
    trainer=SFTTrainer(model=c['model_name_or_path'],args=cfg,train_dataset=ds['train'],eval_dataset=ds['validation'],processing_class=tok,peft_config=lora,model_init_kwargs={'quantization_config':q,'device_map':'auto','trust_remote_code':True})
    trainer.train(); trainer.save_model(c['output_dir']); tok.save_pretrained(c['output_dir'])
if __name__=='__main__': main()
