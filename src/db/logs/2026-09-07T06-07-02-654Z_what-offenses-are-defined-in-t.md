# RAG Retrieval Log

- **Timestamp**: 2026-09-07T06:07:02.654Z
- **Original Query**: `What offenses are defined in the Bharatiya Nyaya Sanhita?`

---

## 1. Original Prompt & Query Transformation

### Query Transformation Prompt
```text

You are an expert at query rewriting for semantic search and retrieval-augmented generation (RAG).

Step back and think about the user's underlying intent before rewriting the query.

Instructions:
1. Analyze the original question.
2. Identify the core goal, concepts, and implied context.
3. Generate at least 3 alternative rewritten queries that better express the same intent.
4. Each rewritten query should be clear, specific, and optimized for semantic retrieval.
5. Do NOT add explanations or reasoning.

Original question:
-------
What offenses are defined in the Bharatiya Nyaya Sanhita?
-------

```

### Enhanced / Rewritten Queries
1. List of criminal offenses and punishments detailed under Bharatiya Nyaya Sanhita
2. What key crimes and legal violations are defined in the Bharatiya Nyaya Sanhita
3. Bharatiya Nyaya Sanhita penal provisions and defined offenses overview
4. How are offenses classified and defined in the Bharatiya Nyaya Sanhita criminal code

---

## 2. Retrieved Chunks (4 Unique Documents)

### Chunk 1
- **Metadata**: `{"loc":"{\"pageNumber\":1,\"lines\":{\"from\":1,\"to\":30}}","pdf":"{\"version\":\"unknown\",\"info\":{\"PDFFormatVersion\":\"1.6\",\"Language\":null,\"EncryptFilterName\":null,\"IsLinearized\":false,\"IsAcroFormPresent\":false,\"IsXFAPresent\":false,\"IsCollectionPresent\":false,\"IsSignaturesPresent\":false,\"ModDate\":\"D:20231212203826+05'30'\",\"Title\":\"Bharatiya Nyaya (Second) Sanhita, 2023\",\"Creator\":\"PageMaker 6.5\",\"CreationDate\":\"D:20231212074828+05'30'\",\"Author\":\"\",\"Producer\":\"Acrobat Distiller 7.0 (Windows)\",\"Subject\":\"\",\"Keywords\":\"\"},\"metadata\":{},\"totalPages\":145}","source":"/Volumes/SSD/Sahil Verma/Coding Projects/Personal/Full Stack/rag-ts/src/data/BNS.pdf"}`

```text
(i)
THE BHARATIYA NYAYA (SECOND) SANHITA, 2023
—————
ARRANGEMENT OF CLAUSES
—————
CHAPTER I
P RELIMINARY
C LAUSES
1. 	Short title, commencement and application.
2. 	Definitions.
3. 	General explanations.
CHAPTER II
OF PUNISHMENTS
4. 	Punishments.
5. 	Commutation of sentence.
6. 	Fractions of terms of punishment.
7. 	Sentence may be (in certain cases of imprisonment) wholly or partly rigorous or
simple.
8. 	Amount of fine, liability in default of payment of fine, etc.
9. 	Limit of punishment of offence made up of several offences.
10. Punishment of person guilty of one of several offences, judgment stating that it is
doubtful of which.
11. Solitary confinement.
12. Limit of solitary confinement.
13. Enhanced punishment for certain offences after previous conviction.
CHAPTER III
GENERAL EXCEPTIONS
14. Act done by a person bound, or by mistake of fact believing himself bound, by law.
15. Act of Judge when acting judicially.
16. Act done pursuant to judgment or order of Court.
```


### Chunk 2
- **Metadata**: `{"loc":"{\"pageNumber\":117,\"lines\":{\"from\":1,\"to\":15}}","pdf":"{\"version\":\"unknown\",\"info\":{\"PDFFormatVersion\":\"1.6\",\"Language\":null,\"EncryptFilterName\":null,\"IsLinearized\":false,\"IsAcroFormPresent\":false,\"IsXFAPresent\":false,\"IsCollectionPresent\":false,\"IsSignaturesPresent\":false,\"ModDate\":\"D:20231212203826+05'30'\",\"Title\":\"Bharatiya Nyaya (Second) Sanhita, 2023\",\"Creator\":\"PageMaker 6.5\",\"CreationDate\":\"D:20231212074828+05'30'\",\"Author\":\"\",\"Producer\":\"Acrobat Distiller 7.0 (Windows)\",\"Subject\":\"\",\"Keywords\":\"\"},\"metadata\":{},\"totalPages\":145}","source":"/Volumes/SSD/Sahil Verma/Coding Projects/Personal/Full Stack/rag-ts/src/data/BNS.pdf"}`

```text
NOTES ON CLAUSES
Clause 1 of the Bill seeks to provide short title, commencement and application of the
proposed legislation.
Clause 2 of the Bill seeks to define certain words and expressions used in the proposed
legislation such as act, omission, counterfeit, dishonestly, gender, good faith, offence,
voluntarily, etc.
Clause 3 of the Bill seeks to provide general Explanations and expressions enumerated
in the proposed legislation subject to the exceptions contained in the "General Exceptions"
Chapter.
Clause 4 of the Bill seeks to provide punishments such as death, imprisonment of life,
Forfeiture of property, fine and Community Service for offences provided under the provisions
of the proposed Bill.
Clause 5 of the Bill relates to commutation of sentence.
This clause seeks to provide that the appropriate Government may, without the consent
of the offender, commute any punishment under this Sanhita to any other punishment in
```


### Chunk 3
- **Metadata**: `{"loc":"{\"pageNumber\":72,\"lines\":{\"from\":46,\"to\":87}}","pdf":"{\"version\":\"unknown\",\"info\":{\"PDFFormatVersion\":\"1.6\",\"Language\":null,\"EncryptFilterName\":null,\"IsLinearized\":false,\"IsAcroFormPresent\":false,\"IsXFAPresent\":false,\"IsCollectionPresent\":false,\"IsSignaturesPresent\":false,\"ModDate\":\"D:20231212203826+05'30'\",\"Title\":\"Bharatiya Nyaya (Second) Sanhita, 2023\",\"Creator\":\"PageMaker 6.5\",\"CreationDate\":\"D:20231212074828+05'30'\",\"Author\":\"\",\"Producer\":\"Acrobat Distiller 7.0 (Windows)\",\"Subject\":\"\",\"Keywords\":\"\"},\"metadata\":{},\"totalPages\":145}","source":"/Volumes/SSD/Sahil Verma/Coding Projects/Personal/Full Stack/rag-ts/src/data/BNS.pdf"}`

```text
Suraksha Sanhita, 2023, shall be punished with imprisonment for a term which may extend to
three years, or with fine, or with both, or with community service, and where a declaration has
been made under sub-section (4) of that section pronouncing him as a proclaimed offender,
he shall be punished with imprisonment for a term which may extend to seven years and shall
also be liable to fine.
Absconding to
avoid service
of summons or
other
proceeding.
Preventing
service of
summons or
other
proceeding, or
preventing
publication
thereof.
Non-
attendance in
obedience to
an order from
public servant.
Non-
appearance in
response to a
proclamation
under
section 84 of
Bharatiya
Nagarik
Suraksha
Sanhita, 2023.
5
1 0
1 5
2 0
2 5
3 0
3 5
4 0
4 5
```


### Chunk 4
- **Metadata**: `{"loc":"{\"pageNumber\":14,\"lines\":{\"from\":1,\"to\":21}}","pdf":"{\"version\":\"unknown\",\"info\":{\"PDFFormatVersion\":\"1.6\",\"Language\":null,\"EncryptFilterName\":null,\"IsLinearized\":false,\"IsAcroFormPresent\":false,\"IsXFAPresent\":false,\"IsCollectionPresent\":false,\"IsSignaturesPresent\":false,\"ModDate\":\"D:20231212203826+05'30'\",\"Title\":\"Bharatiya Nyaya (Second) Sanhita, 2023\",\"Creator\":\"PageMaker 6.5\",\"CreationDate\":\"D:20231212074828+05'30'\",\"Author\":\"\",\"Producer\":\"Acrobat Distiller 7.0 (Windows)\",\"Subject\":\"\",\"Keywords\":\"\"},\"metadata\":{},\"totalPages\":145}","source":"/Volumes/SSD/Sahil Verma/Coding Projects/Personal/Full Stack/rag-ts/src/data/BNS.pdf"}`

```text
1
THE BHARATIYA NYAYA (SECOND) SANHITA, 2023
A
BILL
to consolidate and amend the provisions relating to offences and for matters connected
therewith or incidental thereto.
B E it enacted by Parliament in the Seventy-fourth Year of the Republic of India as
follows:––
CHAPTER I
PRELIMINARY
1. (1) This Act may be called the Bharatiya Nyaya (Second) Sanhita, 2023.
(2) It shall come into force on such date as the Central Government may, by notification
in the Official Gazette, appoint, and different dates may be appointed for different provisions
of this Sanhita.
Short title,
commencement
and
application.
5
AS INTRODUCED IN LOK SABHA
Bill No. 173 of 2023
```


---

## 3. Final Prompt Sent to LLM

```text

You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. 
If you don't know the answer, just say that you don't know.

Question: What offenses are defined in the Bharatiya Nyaya Sanhita?

Context: 
(i)
THE BHARATIYA NYAYA (SECOND) SANHITA, 2023
—————
ARRANGEMENT OF CLAUSES
—————
CHAPTER I
P RELIMINARY
C LAUSES
1. 	Short title, commencement and application.
2. 	Definitions.
3. 	General explanations.
CHAPTER II
OF PUNISHMENTS
4. 	Punishments.
5. 	Commutation of sentence.
6. 	Fractions of terms of punishment.
7. 	Sentence may be (in certain cases of imprisonment) wholly or partly rigorous or
simple.
8. 	Amount of fine, liability in default of payment of fine, etc.
9. 	Limit of punishment of offence made up of several offences.
10. Punishment of person guilty of one of several offences, judgment stating that it is
doubtful of which.
11. Solitary confinement.
12. Limit of solitary confinement.
13. Enhanced punishment for certain offences after previous conviction.
CHAPTER III
GENERAL EXCEPTIONS
14. Act done by a person bound, or by mistake of fact believing himself bound, by law.
15. Act of Judge when acting judicially.
16. Act done pursuant to judgment or order of Court.

---

NOTES ON CLAUSES
Clause 1 of the Bill seeks to provide short title, commencement and application of the
proposed legislation.
Clause 2 of the Bill seeks to define certain words and expressions used in the proposed
legislation such as act, omission, counterfeit, dishonestly, gender, good faith, offence,
voluntarily, etc.
Clause 3 of the Bill seeks to provide general Explanations and expressions enumerated
in the proposed legislation subject to the exceptions contained in the "General Exceptions"
Chapter.
Clause 4 of the Bill seeks to provide punishments such as death, imprisonment of life,
Forfeiture of property, fine and Community Service for offences provided under the provisions
of the proposed Bill.
Clause 5 of the Bill relates to commutation of sentence.
This clause seeks to provide that the appropriate Government may, without the consent
of the offender, commute any punishment under this Sanhita to any other punishment in

---

Suraksha Sanhita, 2023, shall be punished with imprisonment for a term which may extend to
three years, or with fine, or with both, or with community service, and where a declaration has
been made under sub-section (4) of that section pronouncing him as a proclaimed offender,
he shall be punished with imprisonment for a term which may extend to seven years and shall
also be liable to fine.
Absconding to
avoid service
of summons or
other
proceeding.
Preventing
service of
summons or
other
proceeding, or
preventing
publication
thereof.
Non-
attendance in
obedience to
an order from
public servant.
Non-
appearance in
response to a
proclamation
under
section 84 of
Bharatiya
Nagarik
Suraksha
Sanhita, 2023.
5
1 0
1 5
2 0
2 5
3 0
3 5
4 0
4 5

---

1
THE BHARATIYA NYAYA (SECOND) SANHITA, 2023
A
BILL
to consolidate and amend the provisions relating to offences and for matters connected
therewith or incidental thereto.
B E it enacted by Parliament in the Seventy-fourth Year of the Republic of India as
follows:––
CHAPTER I
PRELIMINARY
1. (1) This Act may be called the Bharatiya Nyaya (Second) Sanhita, 2023.
(2) It shall come into force on such date as the Central Government may, by notification
in the Official Gazette, appoint, and different dates may be appointed for different provisions
of this Sanhita.
Short title,
commencement
and
application.
5
AS INTRODUCED IN LOK SABHA
Bill No. 173 of 2023

Answer:

```

---

## 4. LLM Response

Based on the provided context, a complete list of all offenses defined in the Bharatiya Nyaya Sanhita is not included. However, the context explicitly mentions the following specific offenses:

* **Absconding to avoid service of summons or other proceeding**
* **Preventing service of summons or other proceeding, or preventing publication thereof**
* **Non-attendance in obedience to an order from a public servant**
* **Non-appearance in response to a proclamation under section 84 of the Bharatiya Nagarik Suraksha Sanhita, 2023**
