import os
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# Configuración
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    print("❌ Error: Faltan variables de entorno. Revisa tu archivo .env")
    exit(1)

def setup_database():
    """
    Nota: Lo ideal es ejecutar este SQL en el Editor SQL de Supabase antes de empezar.
    
    -- Habilitar la extensión vectorial
    create extension if not exists vector;

    -- Crear una tabla para guardar documentos
    create table if not exists documents (
      id bigserial primary key,
      content text,
      metadata jsonb,
      embedding vector(1536)
    );

    -- Crear una función para buscar documentos similares
    create or replace function match_documents (
      query_embedding vector(1536),
      match_threshold float,
      match_count int
    )
    returns table (
      id bigint,
      content text,
      metadata jsonb,
      similarity float
    )
    language plpgsql
    as $$
    begin
      return query
      select
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) as similarity
      from documents
      where 1 - (documents.embedding <=> query_embedding) > match_threshold
      order by documents.embedding <=> query_embedding
      limit match_count;
    end;
    $$;
    """
    print("ℹ️  Asegúrate de haber ejecutado el script SQL de configuración en Supabase.")

def ingest_data():
    print("1️⃣  Cargando base de conocimiento...")
    loader = TextLoader("knowledge_base.md", encoding="utf-8")
    documents = loader.load()

    print(f"   -> Documento cargado con {len(documents[0].page_content)} caracteres.")

    print("2️⃣  Dividiendo texto en fragmentos (chunks)...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["##", "\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_documents(documents)
    print(f"   -> Se crearon {len(chunks)} fragmentos.")

    print("3️⃣  Generando embeddings y guardando en Supabase...")
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    vector_store = SupabaseVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        client=supabase,
        table_name="documents",
        query_name="match_documents"
    )

    print("✅ Ingesta completada con éxito. ¡Tu IA ya tiene memoria!")

if __name__ == "__main__":
    setup_database()
    ingest_data()
