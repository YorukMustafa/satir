package com.satir;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "ADMIN_EMAIL=admin@example.test",
      "ADMIN_PASSWORD=safe-password-123"
    })
@AutoConfigureMockMvc
class ApiTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  String reg(String role) throws Exception {
    String email = java.util.UUID.randomUUID() + "@example.com";
    mvc.perform(
            post(role.equals("WRITER") ? "/api/admin/writers" : "/api/register")
                .session(
                    role.equals("WRITER") ? login("admin@example.test") : new MockHttpSession())
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of(
                            "name",
                            "Test User",
                            "email",
                            email,
                            "password",
                            "safe-password-123",
                            "role",
                            role))))
        .andExpect(status().isCreated());
    return email;
  }

  MockHttpSession login(String email) throws Exception {
    return (MockHttpSession)
        mvc.perform(
                post("/api/login")
                    .with(csrf())
                    .param("username", email)
                    .param("password", "safe-password-123"))
            .andExpect(status().isNoContent())
            .andReturn()
            .getRequest()
            .getSession(false);
  }

  String body(boolean published) {
    return "{\"title\":\"Bir film\",\"summary\":\"Kısa özet\",\"body\":\"Uzun bir"
               + " değerlendirme.\",\"category\":\"FILM\",\"workTitle\":\"Arrival\",\"rating\":9,\"spoiler\":true,\"published\":"
        + published
        + "}";
  }

  String create(MockHttpSession s, boolean published) throws Exception {
    return json.readTree(
            mvc.perform(
                    post("/api/posts")
                        .session(s)
                        .with(csrf())
                        .contentType("application/json")
                        .content(body(published)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString())
        .get("id")
        .asText();
  }

  @Test
  void csrfRequired() throws Exception {
    mvc.perform(post("/api/register").contentType("application/json").content("{}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void registrationValidationAndDuplicate() throws Exception {
    String email = reg("READER");
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of(
                            "name",
                            "User",
                            "email",
                            email,
                            "password",
                            "safe-password-123",
                            "role",
                            "WRITER"))))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    "{\"name\":\"X\",\"email\":\"wrong\",\"password\":\"123\",\"role\":\"ADMIN\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void readerCannotPublish() throws Exception {
    mvc.perform(
            post("/api/posts")
                .session(login(reg("READER")))
                .with(csrf())
                .contentType("application/json")
                .content(body(true)))
        .andExpect(status().isForbidden());
  }

  @Test
  void draftsAndOwnership() throws Exception {
    var owner = login(reg("WRITER"));
    String id = create(owner, false);
    mvc.perform(get("/api/posts/" + id)).andExpect(status().isNotFound());
    var other = login(reg("WRITER"));
    mvc.perform(get("/api/posts/" + id).session(other)).andExpect(status().isNotFound());
    mvc.perform(
            put("/api/posts/" + id)
                .session(owner)
                .with(csrf())
                .contentType("application/json")
                .content(body(true)))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/posts/" + id)
                .session(other)
                .with(csrf())
                .contentType("application/json")
                .content(body(true)))
        .andExpect(status().isForbidden());
    mvc.perform(delete("/api/posts/" + id).session(other).with(csrf()))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/posts/" + id)).andExpect(status().isOk());
  }

  @Test
  void commentsBookmarksAndCascade() throws Exception {
    var owner = login(reg("WRITER"));
    String id = create(owner, true);
    var reader = login(reg("READER"));
    mvc.perform(
            post("/api/posts/" + id + "/comments")
                .session(reader)
                .with(csrf())
                .contentType("application/json")
                .content("{\"body\":\"Güzel bir bakış açısı\"}"))
        .andExpect(status().isCreated());
    mvc.perform(get("/api/posts/" + id + "/comments"))
        .andExpect(jsonPath("$[0].body").value("Güzel bir bakış açısı"));
    for (int i = 0; i < 2; i++)
      mvc.perform(put("/api/bookmarks/" + id).session(reader).with(csrf()))
          .andExpect(status().isOk());
    mvc.perform(get("/api/bookmarks").session(reader)).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(delete("/api/posts/" + id).session(owner).with(csrf())).andExpect(status().isOk());
    mvc.perform(get("/api/bookmarks").session(reader)).andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void loginAndLogout() throws Exception {
    String email = reg("READER");
    mvc.perform(post("/api/login").with(csrf()).param("username", email).param("password", "wrong"))
        .andExpect(status().isUnauthorized());
    var s = login(email);
    mvc.perform(get("/api/me").session(s))
        .andExpect(jsonPath("$.email").value(email))
        .andExpect(jsonPath("$.password").doesNotExist());
    mvc.perform(post("/api/logout").session(s).with(csrf())).andExpect(status().isNoContent());
    assertTrue(s.isInvalid());
  }

  @Test
  void anonymousWriteBlocked() throws Exception {
    mvc.perform(post("/api/posts").with(csrf()).contentType("application/json").content(body(true)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void ratingValidation() throws Exception {
    mvc.perform(
            post("/api/posts")
                .session(login(reg("WRITER")))
                .with(csrf())
                .contentType("application/json")
                .content(body(true).replace("\"rating\":9", "\"rating\":11")))
        .andExpect(status().isBadRequest());
  }

  @Test
  void publicCannotChooseWriterOrAdminRole() throws Exception {
    for (String role : new String[] {"WRITER", "ADMIN"}) {
      String email = java.util.UUID.randomUUID() + "@example.com";
      mvc.perform(
              post("/api/register")
                  .with(csrf())
                  .contentType("application/json")
                  .content(
                      json.writeValueAsString(
                          Map.of(
                              "name",
                              "Reader",
                              "email",
                              email,
                              "password",
                              "safe-password-123",
                              "role",
                              role))))
          .andExpect(status().isCreated());
      var reader = login(email);
      mvc.perform(get("/api/me").session(reader)).andExpect(jsonPath("$.role").value("READER"));
      mvc.perform(
              post("/api/posts")
                  .session(reader)
                  .with(csrf())
                  .contentType("application/json")
                  .content(body(true)))
          .andExpect(status().isForbidden());
    }
  }

  @Test
  void writerManagementIsAdminOnly() throws Exception {
    mvc.perform(get("/api/admin/writers")).andExpect(status().isUnauthorized());
    for (String role : new String[] {"READER", "WRITER"}) {
      var session = login(reg(role));
      mvc.perform(get("/api/admin/writers").session(session)).andExpect(status().isForbidden());
      mvc.perform(
              post("/api/admin/writers")
                  .session(session)
                  .with(csrf())
                  .contentType("application/json")
                  .content(
                      "{\"name\":\"Intruder\",\"email\":\"intruder@example.test\",\"password\":\"safe-password-123\"}"))
          .andExpect(status().isForbidden());
      mvc.perform(
              post("/api/admin/writers/promote")
                  .session(session)
                  .with(csrf())
                  .contentType("application/json")
                  .content("{\"email\":\"intruder@example.test\"}"))
          .andExpect(status().isForbidden());
    }
    mvc.perform(get("/api/admin/writers").session(login("admin@example.test")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].role").value("WRITER"))
        .andExpect(jsonPath("$[0].password").doesNotExist());
  }

  @Test
  void adminCanPromoteReader() throws Exception {
    String email = reg("READER");
    mvc.perform(
            post("/api/admin/writers/promote")
                .session(login("admin@example.test"))
                .with(csrf())
                .contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", email))))
        .andExpect(status().isOk());
    var writer = login(email);
    mvc.perform(get("/api/me").session(writer)).andExpect(jsonPath("$.role").value("WRITER"));
    create(writer, true);
  }

  @Test
  void newCategoriesDoNotRequireFilmFields() throws Exception {
    var writer = login(reg("WRITER"));
    for (String cat : new String[] {"BLOG", "HISTORY", "TECH", "SPORT"}) {
      String content =
          json.writeValueAsString(
              Map.of(
                  "title",
                  "Kategori testi",
                  "summary",
                  "Özet",
                  "body",
                  "İçerik",
                  "category",
                  cat,
                  "workTitle",
                  "",
                  "published",
                  true,
                  "spoiler",
                  false));
      String id =
          json.readTree(
                  mvc.perform(
                          post("/api/posts")
                              .session(writer)
                              .with(csrf())
                              .contentType("application/json")
                              .content(content))
                      .andExpect(status().isCreated())
                      .andReturn()
                      .getResponse()
                      .getContentAsString())
              .get("id")
              .asText();
      mvc.perform(get("/api/posts").param("category", cat))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$[0].category").value(cat));
      mvc.perform(get("/api/posts/" + id)).andExpect(status().isOk());
    }
  }
}
