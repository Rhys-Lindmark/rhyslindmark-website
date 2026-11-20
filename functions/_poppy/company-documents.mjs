export const companyDocuments = {
  "/poppy/openapi.json": {
    "openapi": "3.1.0",
    "info": {
      "title": "Commonplace edition catalog",
      "version": "1.0.0"
    },
    "servers": [
      {
        "url": "https://ai.rhyslindmark.com"
      }
    ],
    "paths": {
      "/poppy/api/edition.json": {
        "get": {
          "operationId": "getCommonplaceEdition",
          "summary": "Read the public terms and source selections for a Commonplace edition",
          "responses": {
            "200": {
              "description": "Commonplace reading edition"
            }
          }
        }
      }
    }
  },
  "/poppy/api/edition.json": {
    "id": "learning-and-courage",
    "title": "Learning and Courage",
    "store": "Commonplace",
    "storefront": "https://ai.rhyslindmark.com/commonplace/",
    "format": "5x8",
    "currency": "USD",
    "price": "0.00",
    "quotes": [
      {
        "id": "press-emerson-0",
        "author": "Ralph Waldo Emerson",
        "source": "Self-Reliance"
      },
      {
        "id": "press-emerson-1",
        "author": "Ralph Waldo Emerson",
        "source": "Self-Reliance"
      },
      {
        "id": "press-emerson-2",
        "author": "Ralph Waldo Emerson",
        "source": "Self-Reliance"
      },
      {
        "id": "press-emerson-3",
        "author": "Ralph Waldo Emerson",
        "source": "Self-Reliance"
      },
      {
        "id": "press-emerson-4",
        "author": "Ralph Waldo Emerson",
        "source": "Self-Reliance"
      },
      {
        "id": "press-hobbes-0",
        "author": "Thomas Hobbes",
        "source": "Leviathan"
      }
    ]
  }
};
